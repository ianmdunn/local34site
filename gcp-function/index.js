const { Storage } = require('@google-cloud/storage');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const sharp = require('sharp');

const storage = new Storage();
const bucketName = process.env.BUCKET_NAME || 'local34-game-leaderboard';
const bucket = storage.bucket(bucketName);
const visionClient = new ImageAnnotatorClient();

// Rate limit: max POSTs per IP per minute (in-memory, per instance)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_POSTS = 5;
const rateLimitMap = new Map();
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000; // clean stale entries every 5 min

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_POSTS;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_CLEANUP_INTERVAL);

function getAllowedOrigins() {
  const raw = process.env.LEADERBOARD_ALLOWED_ORIGINS || '';
  if (!raw.trim()) return ['https://local34.org', 'https://dev.local34.org', 'http://localhost:4321'];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function getCorsOrigin(req) {
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || '*';
}

/** Detect face center in image buffer using Cloud Vision API. Returns { x, y } or null. */
async function detectFaceCenter(buffer) {
  try {
    const [result] = await visionClient.faceDetection({ image: { content: buffer } });
    const faces = result?.faceAnnotations;
    if (!faces?.length) return null;
    const face = faces[0];
    const poly = face.fdBoundingPoly?.vertices || face.boundingPoly?.vertices;
    if (!poly?.length) return null;
    const x = poly.reduce((s, v) => s + (v.x ?? 0), 0) / poly.length;
    const y = poly.reduce((s, v) => s + (v.y ?? 0), 0) / poly.length;
    return { x, y };
  } catch (err) {
    console.warn('Vision face detection skipped:', err.message);
    return null;
  }
}

/** Crop image to aspect ratio centered on focal point. */
async function cropToFocalPoint(buffer, focalX, focalY, aspectRatio = 16 / 9) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  const imgW = meta.width || 0;
  const imgH = meta.height || 0;
  if (!imgW || !imgH) return buffer;

  let cropW = Math.min(imgW, Math.round(imgH * aspectRatio));
  let cropH = Math.round(cropW / aspectRatio);
  if (cropH > imgH) {
    cropH = imgH;
    cropW = Math.round(imgH * aspectRatio);
  }
  if (cropW > imgW) cropW = imgW;

  const left = Math.max(0, Math.min(Math.round(focalX - cropW / 2), imgW - cropW));
  const top = Math.max(0, Math.min(Math.round(focalY - cropH / 2), imgH - cropH));

  return img.extract({ left, top, width: cropW, height: cropH }).toBuffer();
}

/** Proxy Directus assets so the token stays server-side. No token in HTML. */
exports.proxyDirectusImage = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const id = req.query.id || req.query.file_id;
  const directusUrl = process.env.DIRECTUS_URL || process.env.PUBLIC_DIRECTUS_URL;
  const token = process.env.DIRECTUS_TOKEN;

  if (!id || !directusUrl || !token) {
    res.status(400).send('Missing id, DIRECTUS_URL, or DIRECTUS_TOKEN');
    return;
  }

  const assetUrl = `${directusUrl.replace(/\/$/, '')}/assets/${id}`;
  try {
    const upstream = await fetch(assetUrl, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok) {
      res.status(upstream.status).send(upstream.statusText);
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.set('Content-Type', contentType);
    const cacheControl = upstream.headers.get('cache-control') || 'public, max-age=31536000, immutable';
    res.set('Cache-Control', cacheControl);

    if (req.method === 'HEAD') {
      res.status(200).send('');
      return;
    }

    let buffer = Buffer.from(await upstream.arrayBuffer());

    const skipFace = req.query.face === '0';
    const isRaster = /^image\/(jpeg|jpg|png|webp|gif|bmp)/i.test(contentType);
    if (!skipFace && isRaster) {
      const focal = await detectFaceCenter(buffer);
      if (focal) {
        try {
          buffer = await cropToFocalPoint(buffer, focal.x, focal.y);
        } catch (e) {
          console.warn('Smart crop failed, using original:', e.message);
        }
      }
    }

    res.status(200).send(buffer);
  } catch (err) {
    console.error('Directus proxy error:', err);
    res.status(502).send('Bad Gateway');
  }
};

exports.leaderboard = async (req, res) => {
  const corsOrigin = getCorsOrigin(req);
  res.set('Access-Control-Allow-Origin', corsOrigin);
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const fileName = `leaderboard_${today}.json`;
  const file = bucket.file(fileName);

  async function getScores() {
    try {
      const [exists] = await file.exists();
      if (!exists) return [];
      const [content] = await file.download();
      return JSON.parse(content.toString());
    } catch (error) {
      console.error('Error reading leaderboard:', error);
      return [];
    }
  }

  try {
    if (req.method === 'GET') {
      const scores = await getScores();
      res.status(200).json(scores);
      return;
    }

    if (req.method === 'POST') {
      const origin = req.headers.origin;
      const allowed = getAllowedOrigins();
      if (origin && allowed.length > 0 && !allowed.includes(origin)) {
        res.status(403).json({ error: 'Origin not allowed' });
        return;
      }

      const clientIp = getClientIp(req);
      if (!checkRateLimit(clientIp)) {
        res.status(429).json({ error: 'Too many submissions. Try again in a minute.' });
        return;
      }

      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          res.status(400).send('Invalid JSON');
          return;
        }
      }
      const { initials, score, yaleJackpot } = body || {};
      if (!initials || typeof score !== 'number') {
        res.status(400).send('Invalid data');
        return;
      }
      if (score < 0 || score > 999999 || !Number.isFinite(score)) {
        res.status(400).send('Invalid score');
        return;
      }

      const scores = await getScores();
      const entry = {
        initials: initials.toUpperCase().slice(0, 3),
        score,
        date: Date.now(),
        ...(typeof yaleJackpot === 'number' && yaleJackpot >= 0 && { yaleJackpot }),
      };
      scores.push(entry);
      scores.sort((a, b) => b.score - a.score);
      const top10 = scores.slice(0, 10);

      await file.save(JSON.stringify(top10), {
        contentType: 'application/json',
        metadata: { cacheControl: 'no-cache' },
      });

      res.status(200).json(top10);
      return;
    }

    res.status(405).send('Method Not Allowed');
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
