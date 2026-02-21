# Decentralized KYC System

> **Verify once. Access everywhere.** Blockchain-anchored KYC with zero-trust consent management.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                USER IDENTITY WALLET                     │
│   React App — private key never leaves browser          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS + JWT + Digital Signature
┌──────────────────────▼──────────────────────────────────┐
│              FastAPI Backend (Python)                    │
│  auth.py  │  kyc.py  │  consent.py  │  audit.py         │
│                                                          │
│  core/security.py   — AES-256-GCM, SHA-256, JWT, ECDSA  │
│  core/blockchain.py — Web3.py contract calls            │
│  core/ipfs.py       — Encrypted off-chain storage       │
└──────────────────────┬──────────────────────────────────┘
          ┌────────────┴──────────────┐
          ▼                           ▼
   Ethereum (Hardhat)           IPFS (Kubo)
   KYCRegistry.sol              Encrypted docs
   - SHA-256 hashes only         CID → AES ciphertext
   - Consent events
   - Immutable audit trail
```

## Data Flow

| Step | Action | Security Measure |
|------|--------|-----------------|
| 1 | User uploads document | File size + type validated |
| 2 | AI fraud scan | Structural + hash check |
| 3 | AES-256-GCM encrypt | New 96-bit nonce per upload |
| 4 | Upload to IPFS | Only ciphertext stored |
| 5 | SHA-256 hash IPFS CID | No PII on blockchain |
| 6 | Register on smart contract | Immutable record |
| 7 | Bank requests access | On-chain event logged |
| 8 | User signs consent (MetaMask) | ECDSA verification required |
| 9 | Consent granted on-chain | Zero-trust enforced |
| 10 | User can revoke anytime | Instant, no grace period |

---

## Quick Start (Docker)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — fill in JWT_SECRET_KEY and AES_ENCRYPTION_KEY

# Generate secrets:
python -c "import secrets; print(secrets.token_hex(32))"

# 2. Start all services
docker-compose up --build

# 3. Deploy smart contract
docker exec -it decentralized-kyc-hardhat-node-1 \
  npx hardhat run scripts/deploy.js --network localhost

# 4. Copy contract address to .env
# KYC_CONTRACT_ADDRESS=0x...

# 5. Open the app
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# IPFS Gateway: http://localhost:8080
```

---

## Manual Setup (No Docker)

### Prerequisites
- Python 3.11+
- Node.js 20+
- IPFS Kubo (optional)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate           # Windows
pip install -r requirements.txt
cp ../.env.example .env         # Fill in secrets
uvicorn app.main:app --reload --port 8000
```

### Smart Contracts
```bash
npm install
npx hardhat node                            # Start local chain
npx hardhat run scripts/deploy.js --network localhost
npx hardhat test                            # Run test suite
```

### Frontend
```bash
cd frontend
npm install
npm run dev                                 # http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Any | Register user account |
| POST | `/auth/login` | Any | Get JWT token |
| POST | `/kyc/upload` | user | Encrypt & register KYC doc |
| GET  | `/kyc/status` | user | Get KYC metadata |
| POST | `/consent/request-access` | bank | Request user's KYC |
| POST | `/consent/grant-access` | user | Grant consent (sig required) |
| POST | `/consent/revoke-access` | user | Revoke consent |
| GET  | `/audit/logs` | any | Paginated audit trail |
| GET  | `/health` | any | Health check |

---

## Security Design

| Feature | Implementation |
|---------|---------------|
| Document Encryption | AES-256-GCM with random 96-bit nonce per file |
| On-chain Storage | SHA-256(IPFS CID) only — zero PII on blockchain |
| Authentication | JWT HS256, 60-min expiry, role embedded |
| Password Hashing | bcrypt, cost factor 12 |
| Consent | ECDSA signature verification (Ethereum) |
| Access Control | Zero-trust RBAC — verified per request |
| Audit | Immutable on-chain events + DB log |
| Key Management | Private keys never server-side |

---

## Folder Structure

```
decentralized-kyc/
├── contracts/
│   └── KYCRegistry.sol       ← Solidity smart contract
├── scripts/
│   └── deploy.js             ← Hardhat deployment
├── test/
│   └── KYCRegistry.test.js   ← Smart contract tests
├── backend/
│   ├── app/
│   │   ├── api/              ← Route handlers
│   │   ├── core/             ← Security, blockchain, IPFS
│   │   ├── db/               ← SQLAlchemy models
│   │   ├── middleware/        ← RBAC
│   │   ├── models/           ← Pydantic schemas
│   │   ├── services/         ← AI fraud detection
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       ← React UI components
│   │   ├── context/          ← Auth + wallet context
│   │   ├── services/         ← Axios API layer
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   └── package.json
├── docs/
├── docker-compose.yml
├── hardhat.config.js
├── package.json
└── .env.example
```

---

## Compliance

- **RBI Guidelines**: Audit log, document expiry (365-day default), validator node for verification
- **GDPR**: Consent framework, right to revoke, data minimisation (only hashes on-chain)
- **Audit Trail**: Immutable blockchain events mirrored in DB for fast querying

---

## Scalability Plan

| Concern | Approach |
|---------|---------|
| Throughput | Horizontal FastAPI scaling behind Nginx |
| Blockchain | Move to Layer-2 (Polygon, Arbitrum) for cheaper TX |
| Storage | IPFS cluster + Filecoin for persistence guarantees |
| Database | Swap SQLite → PostgreSQL + read replicas |
| ZKP-Ready | Architecture supports zk-SNARK proof replacement of raw hash |

---

## Advanced Roadmap

- [ ] ZKP (zk-SNARK) proof of KYC without revealing identity
- [ ] AI document fraud detection (Google Document AI / AWS Rekognition)
- [ ] Video liveness deepfake detection (iProov / Onfido)
- [ ] Multi-chain support (Polygon, BNB Chain)
- [ ] Hardware wallet support (Ledger)
- [ ] KYC NFT credential
