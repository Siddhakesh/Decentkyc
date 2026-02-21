
import sys
import os
import traceback
sys.path.append(os.getcwd())

try:
    print("[Debug] Attempting to import app.main and simulate upload...")
    from app.db.database import SessionLocal, AuditLog, KYCRecord, User
    db = SessionLocal()
    
    # Try a simple query that failed earlier
    print("[Debug] Querying audit logs...")
    logs = db.query(AuditLog).all()
    print(f"[Debug] Found {len(logs)} logs")
    
    print("[Debug] Querying KYC records...")
    records = db.query(KYCRecord).all()
    print(f"[Debug] Found {len(records)} records")
    
    db.close()
    print("[Debug] Check complete - No errors found in script!")
    
except Exception:
    print("\n--- CRITICAL ERROR DETECTED ---")
    traceback.print_exc()
    print("--------------------------------\n")
