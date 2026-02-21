
import asyncio
import os
import sys
from pathlib import Path

# Add backend to sys.path
sys.path.append(os.getcwd())

from app.db.database import SessionLocal, KYCRecord, User, AuditLog, AuditEventType, create_tables
from app.api.kyc import upload_kyc
from fastapi import UploadFile, Request
import io

async def test_upload():
    print("[Debug] Starting upload simulation...")
    db = SessionLocal()
    try:
        # 1. Get a test user
        user = db.query(User).first()
        if not user:
            print("[Debug] No user found in DB. Please register a user first.")
            return

        print(f"[Debug] Using user: {user.email} ({user.id})")

        # 2. Mock a file
        content = b"Mock KYC Document Content"
        file = UploadFile(
            filename="test_passport.jpg",
            file=io.BytesIO(content),
            headers={"content-type": "image/jpeg"}
        )

        # 3. Simulate upload_kyc logic (manually to see steps)
        # We'll just call the function if possible, but it needs a Request object
        # Instead, let's just run the inner logic of upload_kyc
        
        from app.core.config import get_settings
        from app.services.fraud_detection import scan_document
        from app.core.ipfs import ipfs_client
        from app.core.security import sha256_hex, sha256_bytes32
        import uuid
        from datetime import datetime, timezone, timedelta

        settings = get_settings()
        
        print("[Debug] Step 1: Scanning document...")
        fraud_score = await scan_document(content, "image/jpeg")
        print(f"[Debug] Fraud Score: {fraud_score}")

        print("[Debug] Step 2: Uploading to IPFS (Mock)...")
        ipfs_cid = await ipfs_client.upload_encrypted(content)
        print(f"[Debug] IPFS CID: {ipfs_cid}")

        print("[Debug] Step 3: DB Operations...")
        kyc_hash_hex = sha256_hex(ipfs_cid)
        
        # This is where it might be failing
        try:
            print("[Debug] Deleting old records...")
            db.query(KYCRecord).filter(KYCRecord.user_id == user.id).delete()
            db.flush()
            
            print("[Debug] Adding new KYC record...")
            kyc_record = KYCRecord(
                id=str(uuid.uuid4()),
                user_id=user.id,
                ipfs_cid=ipfs_cid,
                kyc_hash=kyc_hash_hex,
                doc_type="passport",
                fraud_score=fraud_score
            )
            db.add(kyc_record)
            
            print("[Debug] Adding Audit Log...")
            db.add(AuditLog(
                id=str(uuid.uuid4()),
                actor_id=user.id,
                target_user_id=user.id,
                event_type=AuditEventType.kyc_registered,
                details=f"Debug upload test"
            ))
            
            print("[Debug] Committing...")
            db.commit()
            print("[Debug] Commit successful!")
            
        except Exception as db_err:
            print(f"[Debug] DB ERROR: {db_err}")
            db.rollback()
            raise db_err

    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_tables()
    asyncio.run(test_upload())
