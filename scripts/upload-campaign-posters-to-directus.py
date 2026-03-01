#!/usr/bin/env python3
"""
Upload Worker Profile Campaign PDFs to Directus (wecantkeepup container).

For each PDF in the design folder:
  1. Extract the first (main) image and upload to Directus Files.
  2. Use Gemini to extract Name, Department, and Testimonial (and optional fields) as JSON.
  3. Create an item in the wecantkeepup collection linking the image.

Prerequisites:
  - Admin or static token with schema create access (to create collection/fields) and create on the wecantkeepup collection.
  - The script creates the wecantkeepup collection and fields (name, department, testimonial, profile_image_url) if missing.
  - Images are uploaded to the GCS assets bucket under wecantkeepup/ (set GCS_BUCKET_NAME, GCS_BUCKET_URL, GOOGLE_APPLICATION_CREDENTIALS).
  - Use --no-schema to skip schema creation (collection must already exist).

Environment (same Directus as site: PUBLIC_DIRECTUS_URL + DIRECTUS_TOKEN from .env):
  GEMINI_API_KEY          - Google AI API key for Gemini
  GCS_BUCKET_NAME         - GCS bucket for assets (images saved under wecantkeepup/)
  GCS_BUCKET_URL          - Public URL of that bucket (e.g. https://storage.googleapis.com/local34site-assetfiles)
  GOOGLE_APPLICATION_CREDENTIALS - Path to service account JSON (e.g. .gcp/local34site-assets-service-key.json)
  WECANTKEEPUP_PDF_FOLDER - Folder containing PDFs (default: Box path below)
  WECANTKEEPUP_COLLECTION - Collection name (default: wecantkeepup)

Usage:
  pip install -r scripts/requirements-wecantkeepup.txt
  # Set env vars, then:
  python scripts/upload-campaign-posters-to-directus.py
  python scripts/upload-campaign-posters-to-directus.py --dry-run
  python scripts/upload-campaign-posters-to-directus.py --limit 2
"""

import json
import os
import re
import sys
import time
from pathlib import Path

# Load .env from project root if python-dotenv is available
try:
    from dotenv import load_dotenv
    script_dir = Path(__file__).resolve().parent
    load_dotenv(script_dir.parent / ".env")
except ImportError:
    pass

import requests

# Optional deps: fail with clear message if missing
try:
    import fitz  # PyMuPDF
except ImportError:
    print("Install PyMuPDF: pip install pymupdf", file=sys.stderr)
    sys.exit(1)

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Install Google GenAI: pip install google-genai", file=sys.stderr)
    sys.exit(1)

try:
    from google.cloud import storage as gcs_storage
except ImportError:
    gcs_storage = None  # optional until first GCS upload


# --- Configuration ---
DEFAULT_PDF_FOLDER = (
    "/Users/iandunn/Library/CloudStorage/Box-Box/Connecticut Locals/"
    "Local 34/2027 CONTRACT/Worker Profile Campaign/DESIGN/FINAL Designs"
)
# Same Directus instance as site (one URL, one token; updates + campaign posters collections)
DIRECTUS_URL = (os.environ.get("PUBLIC_DIRECTUS_URL") or "").strip().rstrip("/")
DIRECTUS_TOKEN = (os.environ.get("DIRECTUS_TOKEN") or "").strip()
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or "").strip()
PDF_FOLDER = os.environ.get("WECANTKEEPUP_PDF_FOLDER", DEFAULT_PDF_FOLDER).strip()
COLLECTION = os.environ.get("WECANTKEEPUP_COLLECTION", "wecantkeepup").strip()

# GCS assets bucket: images saved to wecantkeepup/ folder
GCS_BUCKET_NAME = (os.environ.get("GCS_BUCKET_NAME") or "").strip()
GCS_BUCKET_URL = (os.environ.get("GCS_BUCKET_URL") or "").strip().rstrip("/")
GCS_FOLDER = "wecantkeepup"
_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent
GCS_CREDENTIALS_PATH = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
if GCS_CREDENTIALS_PATH and not os.path.isabs(GCS_CREDENTIALS_PATH):
    GCS_CREDENTIALS_PATH = str(_project_root / GCS_CREDENTIALS_PATH)

HEADERS = {"Authorization": f"Bearer {DIRECTUS_TOKEN}"} if DIRECTUS_TOKEN else {}

# Directus Cloud Run can have cold starts; use longer timeout and retries
API_TIMEOUT = 120
API_RETRIES = 3

# Field definitions for wecantkeepup collection (Directus REST format)
WECANTKEEPUP_FIELDS = [
    {
        "field": "name",
        "type": "string",
        "meta": {"interface": "input", "required": True, "width": "full"},
        "schema": {"is_nullable": False, "max_length": 255},
    },
    {
        "field": "department",
        "type": "string",
        "meta": {"interface": "input", "width": "full"},
        "schema": {"is_nullable": True, "max_length": 255},
    },
    {
        "field": "testimonial",
        "type": "text",
        "meta": {"interface": "input-multiline", "width": "full"},
        "schema": {"is_nullable": True},
    },
    {
        "field": "profile_image_url",
        "type": "string",
        "meta": {"interface": "input", "width": "full", "note": "GCS URL (wecantkeepup/ folder)"},
        "schema": {"is_nullable": True},
    },
    {
        "field": "profile_image_focus_x",
        "type": "decimal",
        "meta": {"interface": "input", "width": "half", "note": "Focal point X (0-1) for background-position"},
        "schema": {"is_nullable": True, "numeric_precision": 5, "numeric_scale": 4},
    },
    {
        "field": "profile_image_focus_y",
        "type": "decimal",
        "meta": {"interface": "input", "width": "half", "note": "Focal point Y (0-1) for background-position"},
        "schema": {"is_nullable": True, "numeric_precision": 5, "numeric_scale": 4},
    },
]


def _api(method: str, path: str, **kwargs) -> requests.Response:
    """Directus REST call; returns response (caller checks .ok). Retries on timeout/connection errors (cold starts)."""
    url = f"{DIRECTUS_URL}{path}"
    h = {**HEADERS}
    if "json" in kwargs:
        h.setdefault("Content-Type", "application/json")
    kwargs.setdefault("timeout", API_TIMEOUT)
    last_err = None
    for attempt in range(API_RETRIES):
        try:
            return requests.request(method, url, headers=h, **kwargs)
        except (requests.exceptions.ReadTimeout, requests.exceptions.ConnectTimeout, requests.exceptions.ConnectionError):
            if attempt < API_RETRIES - 1:
                wait = (2 ** attempt) * 5  # 5, 10, 20 sec
                print(f"  Directus request timed out, retrying in {wait}s ({attempt + 1}/{API_RETRIES})...", file=sys.stderr)
                time.sleep(wait)
            else:
                raise


def ensure_wecantkeepup_schema(dry_run: bool) -> bool:
    """Create wecantkeepup collection and fields if missing. Returns True if schema is ready."""
    r = _api("GET", "/collections")
    if not r.ok:
        print(f"Cannot list collections: {r.status_code} {r.text[:150]}", file=sys.stderr)
        return False
    data = r.json()
    collections = data.get("data", data) if isinstance(data, dict) else data
    if not isinstance(collections, list):
        collections = []
    exists = any(c.get("collection") == COLLECTION for c in collections)
    if not exists:
        if dry_run:
            print(f"[dry-run] Would create collection: {COLLECTION} with fields: name, department, testimonial, profile_image_url")
            return True
        payload = {
            "collection": COLLECTION,
            "meta": {"icon": "person", "note": "Worker profile campaign posters"},
            "schema": {"name": COLLECTION},
            "fields": [
                {**f, "collection": COLLECTION} for f in WECANTKEEPUP_FIELDS
            ],
        }
        r2 = _api("POST", "/collections", json=payload)
        if not r2.ok:
            print(f"Create collection failed: {r2.status_code} {r2.text[:200]}", file=sys.stderr)
            return False
        print(f"Created collection: {COLLECTION} (with fields: name, department, testimonial, profile_image_url)")
        return True
    # Collection exists; ensure all fields exist
    r = _api("GET", f"/fields/{COLLECTION}")
    if not r.ok:
        print(f"Cannot list fields: {r.status_code}", file=sys.stderr)
        return True  # assume ready
    data = r.json()
    field_list = data.get("data", data) if isinstance(data, dict) else data
    existing = {f.get("field") for f in (field_list or []) if f.get("field")}
    for fd in WECANTKEEPUP_FIELDS:
        if fd["field"] in existing:
            continue
        if dry_run:
            print(f"[dry-run] Would add field: {fd['field']} ({fd['type']})")
            continue
        r2 = _api("POST", f"/fields/{COLLECTION}", json={**fd, "collection": COLLECTION})
        if r2.ok:
            print(f"Added field: {fd['field']}")
        else:
            print(f"Skip field {fd['field']}: {r2.status_code} {r2.text[:100]}", file=sys.stderr)
    return True


def _slug(s: str) -> str:
    """Safe blob name: lowercase, alphanumeric and single dashes."""
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-") or "image"


# Straight " and typographic “ ” (U+201C, U+201D) to strip from start/end of testimonial
_QUOTE_CHARS = '"\u201c\u201d'


def _strip_quotes(s: str) -> str:
    """Remove any \" or typographic “ ” at the start or end of the string. Leave ' and other quotes inside."""
    if not s:
        return s
    s = s.strip()
    s = s.lstrip(_QUOTE_CHARS).rstrip(_QUOTE_CHARS)
    return s.strip()


_gcs_warned = False


def _image_to_16_9_png(image_bytes: bytes, ext: str) -> bytes:
    """Return image as PNG, cropped to 16:9 center if needed. Embedded poster image is 16:9; ensure output is too."""
    pix = fitz.Pixmap(image_bytes)
    try:
        w, h = pix.width, pix.height
        target_ratio = 16 / 9
        current_ratio = w / h if h else 0
        if abs(current_ratio - target_ratio) <= 0.01:
            return pix.tobytes(output="png")
        # Center-crop to 16:9
        if current_ratio > target_ratio:
            crop_w = int(round(h * 16 / 9))
            crop_h = h
            x0 = (w - crop_w) // 2
            y0 = 0
        else:
            crop_w = w
            crop_h = int(round(w * 9 / 16))
            x0 = 0
            y0 = (h - crop_h) // 2
        dest = fitz.Pixmap(pix.colorspace, fitz.IRect(0, 0, crop_w, crop_h), pix.alpha)
        pix.set_origin(-x0, -y0)
        dest.copy(pix, fitz.IRect(0, 0, crop_w, crop_h))
        return dest.tobytes(output="png")
    finally:
        pix = None


def upload_image_to_gcs(image_bytes: bytes, base_name: str, ext: str) -> str | None:
    """Upload image to GCS as 16:9 PNG (transparency preserved; cropped to 16:9 if needed)."""
    global _gcs_warned
    if not GCS_BUCKET_NAME or not GCS_BUCKET_URL:
        if not _gcs_warned:
            _gcs_warned = True
            print("  GCS_BUCKET_NAME and GCS_BUCKET_URL required for image upload; profile_image_url will be empty.", file=sys.stderr)
        return None
    if gcs_storage is None:
        if not _gcs_warned:
            _gcs_warned = True
            print("  Install google-cloud-storage for GCS uploads: pip install google-cloud-storage (profile_image_url will be empty).", file=sys.stderr)
        return None
    safe_name = _slug(base_name) or "image"
    try:
        out_bytes = _image_to_16_9_png(image_bytes, ext or "png")
    except Exception as e:
        print(f"  Could not process image to 16:9 PNG: {e}", file=sys.stderr)
        return None
    blob_name = f"{GCS_FOLDER}/{safe_name}.png"
    content_type = "image/png"
    try:
        if GCS_CREDENTIALS_PATH and os.path.isfile(GCS_CREDENTIALS_PATH):
            from google.oauth2 import service_account
            credentials = service_account.Credentials.from_service_account_file(GCS_CREDENTIALS_PATH)
            client = gcs_storage.Client(credentials=credentials, project=credentials.project_id)
        else:
            client = gcs_storage.Client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(blob_name)
        blob.upload_from_string(out_bytes, content_type=content_type)
        url = f"{GCS_BUCKET_URL}/{blob_name}"
        return url
    except Exception as e:
        print(f"  GCS upload failed: {e}", file=sys.stderr)
        return None


def extract_image_from_pdf(pdf_path: str) -> tuple[bytes | None, str | None]:
    """Extract the first embedded image from the first page. Returns (image_bytes, ext) or (None, None)."""
    doc = fitz.open(pdf_path)
    try:
        for page in doc:
            image_list = page.get_images(full=True)
            if image_list:
                xref = image_list[0][0]
                base_image = doc.extract_image(xref)
                return base_image["image"], base_image.get("ext", "png")
    finally:
        doc.close()
    return None, None


def extract_fields_with_gemini(pdf_path: str, client: genai.Client) -> dict | None:
    """Use Gemini to extract name, department, testimonial (and any other fields) as JSON."""
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    prompt = (
        "From this PDF (worker profile / campaign poster), extract the following as a single JSON object. "
        "Use only the keys listed; if something is missing use empty string. "
        "Return ONLY valid JSON, no markdown or explanation.\n"
        "Keys: name (string), department (string), testimonial (string)."
    )
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    prompt,
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                ],
            )
            break
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
            if is_rate_limit and attempt < max_retries - 1:
                wait = 60 * (attempt + 1)
                print(f"  Gemini rate limit (429), retry in {wait}s...", file=sys.stderr)
                time.sleep(wait)
                continue
            print(f"  Gemini error: {e}", file=sys.stderr)
            return None

    text = (response.text or "").strip() if hasattr(response, "text") else ""
    if not text:
        print("  Gemini returned no text", file=sys.stderr)
        return None

    # Strip markdown code fence if present
    if "```" in text:
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  JSON parse error: {e}\n  Raw: {text[:300]}", file=sys.stderr)
        return None


_403_hint_shown = False


def create_poster_item(data: dict, profile_image_url: str | None) -> bool:
    """Create one wecantkeepup item in Directus. profile_image_url is the uploaded GCS asset URL."""
    global _403_hint_shown
    # Build payload so profile_image_url is always the GCS URL we uploaded (never from Gemini)
    payload = {
        "name": (data.get("name") or "").strip(),
        "department": (data.get("department") or "").strip(),
        "testimonial": _strip_quotes(data.get("testimonial") or ""),
    }
    if profile_image_url:
        payload["profile_image_url"] = profile_image_url
    r = _api("POST", f"/items/{COLLECTION}", json=payload)
    if not r.ok:
        print(f"  Create item failed: {r.status_code} {r.text[:200]}", file=sys.stderr)
        if r.status_code == 403 and not _403_hint_shown:
            _403_hint_shown = True
            print(
                f"\n  → In Directus Admin: create collection \"{COLLECTION}\" with fields: name, department, testimonial, profile_image_url.\n"
                "  → Settings → Access Control → give your token's role CREATE on that collection.\n",
                file=sys.stderr,
            )
        return False
    return True


def process_poster(pdf_path: str, client: genai.Client, dry_run: bool) -> bool:
    """Process one PDF: extract image, extract text with Gemini, upload image to GCS, create Directus item."""
    pdf_stem = Path(pdf_path).stem
    print(f"Processing: {pdf_path}")

    # 1. Extract image from PDF
    image_bytes, ext = extract_image_from_pdf(pdf_path)
    if not image_bytes:
        print("  No image found in PDF")
    ext = ext or "png"

    # 2. Extract structured data with Gemini
    data = extract_fields_with_gemini(pdf_path, client)
    if not data:
        print("  Skipping (Gemini extraction failed)")
        return False

    # Ensure expected keys exist
    for key in ("name", "department", "testimonial"):
        data.setdefault(key, "")

    # 3. Upload image to GCS (wecantkeepup/ folder), use name from data for filename
    profile_image_url = None
    if image_bytes:
        base_name = (data.get("name") or pdf_stem).strip() or "image"
        if dry_run:
            print(f"  [dry-run] Would upload image to GCS {GCS_FOLDER}/{_slug(base_name)}.{ext} ({len(image_bytes)} bytes)")
            profile_image_url = f"{GCS_BUCKET_URL or 'https://bucket'}/{GCS_FOLDER}/{_slug(base_name)}.{ext}"
        else:
            profile_image_url = upload_image_to_gcs(image_bytes, base_name, ext)

    # 4. Create Directus item (profile_image_url = GCS asset URL when upload succeeded)
    if dry_run:
        print(f"  [dry-run] Would create item: {data.get('name')} | {data.get('department')}")
        return True
    ok = create_poster_item(data, profile_image_url)
    if ok:
        if profile_image_url:
            print(f"  Done: {data.get('name')} (profile_image_url: {profile_image_url})")
        else:
            print(f"  Done: {data.get('name')} (no image URL)")
    return ok


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Upload campaign poster PDFs to Directus (wecantkeepup)")
    parser.add_argument("--dry-run", action="store_true", help="Do not upload or create items")
    parser.add_argument("--limit", type=int, default=0, help="Max number of PDFs to process (0 = all)")
    parser.add_argument("--folder", default=PDF_FOLDER, help="Folder containing PDFs")
    parser.add_argument("--no-schema", action="store_true", help="Do not create collection/fields; collection must exist")
    args = parser.parse_args()

    if not DIRECTUS_URL and not args.dry_run:
        print("Set PUBLIC_DIRECTUS_URL in .env", file=sys.stderr)
        sys.exit(1)
    if not DIRECTUS_TOKEN and not args.dry_run:
        print("Set DIRECTUS_TOKEN in .env", file=sys.stderr)
        sys.exit(1)
    if not GEMINI_API_KEY:
        print("Set GEMINI_API_KEY", file=sys.stderr)
        sys.exit(1)

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"Folder not found: {folder}", file=sys.stderr)
        sys.exit(1)

    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs in {folder}", file=sys.stderr)
        sys.exit(0)

    limit = args.limit or len(pdfs)
    pdfs = pdfs[:limit]
    print(f"Found {len(pdfs)} PDF(s). Collection: {COLLECTION}")

    if (GCS_BUCKET_NAME or GCS_BUCKET_URL) and gcs_storage is None and not args.dry_run:
        print("Note: google-cloud-storage not installed; images will not be uploaded to GCS (pip install google-cloud-storage).\n", file=sys.stderr)

    if not args.no_schema and not args.dry_run:
        if not ensure_wecantkeepup_schema(dry_run=False):
            sys.exit(1)
    elif not args.no_schema and args.dry_run:
        ensure_wecantkeepup_schema(dry_run=True)

    client = genai.Client(api_key=GEMINI_API_KEY)
    ok_count = 0
    for path in pdfs:
        if process_poster(str(path), client, args.dry_run):
            ok_count += 1
    print(f"\nProcessed {ok_count}/{len(pdfs)} successfully.")
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
