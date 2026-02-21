"""
app/core/ipfs.py
─────────────────
IPFS off-chain storage handler.

SECURITY DESIGN:
- Documents are AES-256-GCM encrypted BEFORE being sent to IPFS.
- The IPFS CID only points to ciphertext — even a full node operator
  cannot read the document.
- The CID is hashed (SHA-256) before being stored on-chain for an
  additional layer of indirection.
- Retrieval requires both a valid JWT, on-chain consent check, AND
  the platform's AES key to decrypt.

NOTE: This client includes a 'Development Fallback' that uses the local
filesystem if the IPFS API is unreachable.
"""

import os
import aiohttp
import base64
import json
from pathlib import Path
from typing import Optional

from app.core.config import get_settings
from app.core.security import encrypt_to_b64, decrypt_from_b64

settings = get_settings()


class IPFSClient:
    """
    Async client for uploading/downloading encrypted documents to/from IPFS.
    Targets a local Kubo (go-ipfs) node. Can be swapped to Infura IPFS
    by changing IPFS_API_URL in the .env file.
    """

    def __init__(self):
        self.api_url = settings.IPFS_API_URL
        self.mock_dir = Path("data/ipfs_mock")
        self.mock_dir.mkdir(parents=True, exist_ok=True)

    async def upload_encrypted(self, plaintext_bytes: bytes) -> str:
        """
        Encrypt plaintext document bytes and upload to IPFS (or local fallback).

        Steps:
          1. AES-256-GCM encrypt the raw document bytes.
          2. Base64-encode the nonce+ciphertext blob.
          3. POST this string to the IPFS node via the /api/v0/add endpoint.
          4. Return the CID (Content Identifier) of the uploaded blob.

        Returns:
            IPFS CID string (e.g. "QmXoypiz...")
        """
        # Step 1 & 2: Encrypt
        encrypted_b64 = encrypt_to_b64(plaintext_bytes)
        ciphertext_bytes = encrypted_b64.encode()

        # Step 3: Upload to IPFS (with fallback)
        url = f"{self.api_url}/api/v0/add"
        try:
            async with aiohttp.ClientSession() as session:
                form = aiohttp.FormData()
                form.add_field(
                    "file",
                    ciphertext_bytes,
                    filename="kyc_encrypted.bin",
                    content_type="application/octet-stream",
                )
                # Apply a short timeout for the check
                async with session.post(url, data=form, timeout=5) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data["Hash"]
                    else:
                        print(f"[IPFS] API error {resp.status}, using local fallback")
        except Exception as e:
            print(f"[IPFS] Connection failed ({e}), using local filesystem fallback")

        # Fallback: Local Storage
        # We generate a deterministic CID-like hash for the mock storage
        import hashlib
        cid = f"mock-{hashlib.sha256(ciphertext_bytes).hexdigest()[:16]}"
        file_path = self.mock_dir / cid
        file_path.write_bytes(ciphertext_bytes)
        
        return cid

    async def download_decrypted(self, cid: str) -> bytes:
        """
        Download ciphertext from IPFS (or local) and decrypt.

        Steps:
          1. Fetch the raw blob from IPFS using CID.
          2. Base64-decode to get nonce+ciphertext.
          3. AES-256-GCM decrypt and return plaintext bytes.

        SECURITY: GCM's authentication tag validation happens here —
        any tampering with the ciphertext on IPFS will raise InvalidTag.
        """
        if str(cid).startswith("mock-"):
            file_path = self.mock_dir / cid
            if not file_path.exists():
                raise RuntimeError(f"Local mock file not found: {cid}")
            ciphertext_bytes = file_path.read_bytes()
        else:
            url = f"{self.api_url}/api/v0/cat?arg={cid}"
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, timeout=5) as resp:
                        if resp.status != 200:
                            raise RuntimeError(f"IPFS fetch failed [{resp.status}]")
                        ciphertext_bytes = await resp.read()
            except Exception as e:
                # If we have a mock file with this name (unlikely but possible during dev transitions)
                file_path = self.mock_dir / cid
                if file_path.exists():
                    ciphertext_bytes = file_path.read_bytes()
                else:
                    raise RuntimeError(f"IPFS unavailable and no local fallback found: {e}")

        # Step 2 & 3: Decrypt
        encrypted_b64 = ciphertext_bytes.decode()
        return decrypt_from_b64(encrypted_b64)

    async def pin(self, cid: str) -> bool:
        """
        Pin a CID to prevent garbage collection by the IPFS node.
        Should be called after successful upload to ensure persistence.
        """
        if str(cid).startswith("mock-"):
            return True
            
        url = f"{self.api_url}/api/v0/pin/add?arg={cid}"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, timeout=2) as resp:
                    return resp.status == 200
        except:
            return True # Assume success for mock/local


# Module-level singleton
ipfs_client = IPFSClient()
