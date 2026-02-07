const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucketName = process.env.BUCKET_NAME || 'local34-game-leaderboard';
const bucket = storage.bucket(bucketName);

exports.leaderboard = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
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
      const { initials, score } = req.body;
      if (!initials || typeof score !== 'number') {
        res.status(400).send('Invalid data');
        return;
      }

      const scores = await getScores();
      scores.push({ initials: initials.toUpperCase().slice(0, 3), score, date: Date.now() });
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
