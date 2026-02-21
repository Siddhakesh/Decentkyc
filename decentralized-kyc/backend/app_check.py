
import sys
import os
sys.path.append(os.getcwd())

try:
    print("[Check] Importing app.main...")
    from app.main import app
    print("[Check] App imported successfully")
except Exception as e:
    print("[Check] FAILED to import app")
    import traceback
    traceback.print_exc()
