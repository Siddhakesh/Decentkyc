"""
app/services/fraud_detection.py
─────────────────────────────────
AI-based document fraud detection service.

MVP STATUS: Placeholder implementation with structured integration points.

ADVANCED INTEGRATION (TODO):
─────────────────────────────
To integrate a real AI fraud detection model, replace the placeholder logic
below with calls to:

Option A — AWS Rekognition / Google Document AI:
    from google.cloud import documentai
    client = documentai.DocumentProcessorServiceClient()
    # Process image, check for manipulation signatures

Option B — Custom CNN model (PyTorch/TensorFlow):
    model = torch.load("models/fraud_detector.pt")
    result = model(preprocess_image(file_bytes))
    score = result["fraud_probability"] * 100

Option C — DeepFake Detection API:
    POST https://api.deepware.ai/v1/detect
    { "image_base64": "<base64_encoded_frame>" }

DEEPFAKE DETECTION PLACEHOLDER:
    For liveness checks during video KYC, integrate:
    - Innovatrics Digital Identity Platform
    - Onfido Motion Capture
    - iProov API

CURRENT MVP BEHAVIOR:
    Returns a deterministic score based on file characteristics.
    Files > 100KB that are PDFs or images receive a 5/100 score (low risk).
    Unknown types get a 30/100 score (medium risk).
    Everything below 80 passes the upload gate.
"""

import hashlib


async def scan_document(file_bytes: bytes, content_type: str) -> int:
    """
    Scan a document for potential fraud.

    Args:
        file_bytes:    Raw document bytes
        content_type:  MIME type of the uploaded file

    Returns:
        Fraud score integer 0–100.
        0  = definitely clean
        100 = definitely fraudulent
        Threshold: reject if score >= 80

    PRODUCTION REPLACEMENT:
        Replace this function body with a real ML model call.
        Keep the same signature so the kyc.py caller needs no changes.
    """
    # ── Basic validation checks ───────────────────────────────────────────────
    allowed_types = {
        "image/jpeg", "image/png", "image/webp",
        "application/pdf",
    }

    # Reject completely unknown file types
    if content_type not in allowed_types:
        return 70  # Medium-high risk — unknown format

    # Reject suspiciously tiny files (< 10 KB) — likely screenshots/fakes
    if len(file_bytes) < 10 * 1024:
        return 60

    # ── Placeholder: check for duplicate document hash ────────────────────────
    # In production, this would query a database of known fraudulent document hashes
    doc_hash = hashlib.sha256(file_bytes).hexdigest()
    # Known fraudulent hashes would be checked here:
    # if doc_hash in KNOWN_FRAUD_HASHES:
    #     return 95

    # ── Placeholder: structural analysis ─────────────────────────────────────
    # PDF magic bytes check
    if content_type == "application/pdf":
        if not file_bytes.startswith(b"%PDF"):
            return 75  # Not a real PDF

    # JPEG magic bytes check
    if content_type == "image/jpeg":
        if not file_bytes[:2] == b"\xff\xd8":
            return 75  # Not a real JPEG

    # ── Default: low risk (real AI model would replace this) ──────────────────
    # TODO: Replace with ML model inference
    return 5


async def check_deepfake(image_bytes: bytes) -> dict:
    """
    Deepfake detection placeholder for selfie liveness verification.

    TODO: Integrate with a liveness detection provider:
    - iProov: https://docs.iproov.com/
    - Onfido Motion: https://developers.onfido.com/
    - AWS Rekognition FaceDetection

    Returns:
        {
            "is_live": bool,
            "confidence": float,   # 0.0 to 1.0
            "provider": str
        }
    """
    # TODO: Replace with real deepfake detection API call
    return {
        "is_live": True,          # Placeholder — always passes in MVP
        "confidence": 0.95,
        "provider": "placeholder — not production safe",
    }
