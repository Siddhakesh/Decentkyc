import uuid
from sqlalchemy.orm import Session
from app.db.database import User, UserRole
from app.core.security import hash_password

def seed_data(db: Session):
    """Seed the database with a predefined bank user if it doesn't exist."""
    
    # Check if the default bank already exists
    bank_email = "admin@globalbank.com"
    existing_bank = db.query(User).filter(User.email == bank_email).first()
    
    if not existing_bank:
        print(f"[Seed] Creating predefined bank: {bank_email}")
        default_bank = User(
            id=str(uuid.uuid4()),
            email=bank_email,
            hashed_password=hash_password("BankAdmin123!"),
            full_name="Global Bank Corp",
            role=UserRole.bank,
            wallet_address="0xDEMO_GLOBAL_BANK", # Matches our new regex
            description="Global Bank Corp is a premier financial institution specializing in secure digital assets and private wealth management. We leverage DecentKYC to ensure zero-trust compliance for our elite clientele.",
            services="Personal Banking, Private Wealth, Crypto Custody, Institutional Loans"
        )
        db.add(default_bank)
        db.commit()
        print("[Seed] Global Bank created successfully.")
    else:
        print("[Seed] Predefined bank already exists.")
