import secrets

jwt_key = secrets.token_hex(32)
aes_key = secrets.token_hex(32)

# Hardhat account #0 private key (well-known test key, safe for local dev only)
deployer_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

env_lines = [
    "DEBUG=true",
    'ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173"]',
    "DATABASE_URL=sqlite:///./kyc.db",
    f"JWT_SECRET_KEY={jwt_key}",
    "JWT_ALGORITHM=HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES=60",
    f"AES_ENCRYPTION_KEY={aes_key}",
    "BLOCKCHAIN_RPC_URL=http://localhost:8545",
    "KYC_CONTRACT_ADDRESS=",
    f"DEPLOYER_PRIVATE_KEY={deployer_key}",
    "IPFS_API_URL=http://localhost:5001",
    "KYC_DEFAULT_VALIDITY_DAYS=365",
    "MAX_DOCUMENT_SIZE_MB=10",
]

with open(".env", "w") as f:
    f.write("\n".join(env_lines) + "\n")

print("SUCCESS: .env file created")
print(f"JWT_SECRET_KEY={jwt_key}")
print(f"AES_ENCRYPTION_KEY={aes_key}")
