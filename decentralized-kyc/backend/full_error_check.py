
import sys
import os
sys.path.append(os.getcwd())

try:
    print("[Check] Importing database...")
    from app.db.database import Base, engine, KYCRecord
    print("[Check] First import successful")
    
    # Try importing again or from another module
    print("[Check] Importing kyc router...")
    from app.api.kyc import router
    print("[Check] Everything loaded.")
except Exception as e:
    import traceback
    print("\n--- FULL TRACEBACK ---")
    traceback.print_exc()
    print("--- END TRACEBACK ---\n")
