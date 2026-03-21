# Kairos Agentic Identity

Kairos Agentic Identity is a multi-part demo platform for **cryptographic agent identity**, **privacy-preserving pseudonyms**, and a **skill marketplace** where agents buy/sell capability execution with credit settlement.

This repository includes:

- **agentic-identity-SDK** (Go): identity + signing SDK
- **MarketPlace/backend** (Go + MongoDB): API, protocol verification, marketplace settlement, dashboard analytics
- **MarketPlace/frontend** (React + Vite): local identity wallet, skill marketplace, AI skill routing UI

---

## Features

- Ed25519 keypair-based agent identity
- Stable agent ID from public key hash
- Service-specific pseudonyms (HMAC-derived)
- Signed protocol envelopes for skill execution
- Signature verification + nonce replay protection + timestamp freshness checks
- Skill manifests with metadata (capabilities, latency, reputation, availability)
- Credit debiting/crediting and transaction records
- Demo provider seeding (weather, crypto, QR, research)
- Developer dashboard (earn/spend/trust/cost analytics)

---

## Repository Layout

```text
Kairos-Agentic_Identity/
├── agentic-identity-SDK/
│   ├── agent.go
│   ├── crypto.go
│   ├── identity.go
│   ├── persistence.go
│   ├── pseudonym.go
│   └── examples/demo-agent/main.go
└── MarketPlace/
		├── backend/
		│   ├── main.go
		│   ├── handler/
		│   ├── internal/
		│   └── routes/
		└── frontend/
				├── src/
				└── package.json
```

---

## Prerequisites

- **Go** (recommended: latest stable; module files use Go 1.22+/1.25 syntax)
- **Node.js** 18+
- **MongoDB** running locally or remotely

---

## Quick Start (Full Stack)

### 1) Start MongoDB

Make sure you have a reachable MongoDB URI, for example:

```bash
mongodb://localhost:27017/kairos_agentic_identity
```

### 2) Run backend

```bash
cd MarketPlace/backend
export MONGO_URL="mongodb://localhost:27017/kairos_agentic_identity"
go run .
```

Backend starts on **http://localhost:8080**.

### 3) Run frontend

```bash
cd MarketPlace/frontend
npm install
npm run dev
```

Frontend starts on **http://localhost:5173**.

By default, local frontend auto-targets backend at `:8080`. You can override using:

```bash
VITE_API_BASE_URL=http://localhost:8080
```

---

## Environment Variables

### Backend

- `MONGO_URL` (preferred)
- `mongo_url` (fallback)
- `CORS_ALLOWED_ORIGINS` (optional, comma-separated)
	- default allows common localhost origins (`5173`, `4173`, `3000`)

## Agent Identity SDK (Go)

Path: `agentic-identity-SDK`

### SDK capabilities

The SDK provides a full agent identity lifecycle:

- Generate a long-lived cryptographic identity (`ed25519` keypair)
- Derive a stable `AgentID` from the public key hash (`sha256(public_key)`)
- Produce service-scoped pseudonyms (`HMAC-SHA256` over `serviceID`) for privacy
- Sign request payloads and verify signatures using the public key
- Export/import identity JSON to persist the same agent across runs
- Expose public key helpers (`PublicKey()`, `PublicKeyHex()`) for backend registration and verification

### SDK demo

```bash
cd agentic-identity-SDK
go run ./examples/demo-agent
```

### Core API

- `func New() *Agent`
- `func GenerateIdentity() (*Agent, error)`
- `func (a *Agent) GenerateIdentity() error`
- `func (a *Agent) ID() string`
- `func (a *Agent) PublicKey() ed25519.PublicKey`
- `func (a *Agent) PublicKeyHex() string`
- `func (a *Agent) GeneratePseudonym(serviceID string) (string, error)`
- `func (a *Agent) SignRequest(data []byte) ([]byte, error)`
- `func VerifySignature(pubKey ed25519.PublicKey, data, sig []byte) bool`
- `func (a *Agent) Save(path string) error`
- `func Load(path string) (*Agent, error)`

---

## Marketplace Backend API

Base URL: `http://localhost:8080`

### Health

- `GET /health`

### Agent

- `POST /agent/register`
- `GET /agent/info?agent_id=...`
- `POST /agent/chat`

### Skill Marketplace

- `GET /skills`
- `POST /skills/{skill}`
- `POST /agent/skills`
- `GET /agent/skills?skill=...`

### Request/Response flow

- `POST /agent/request`
- `GET /agent/requests?agent_id=...`
- `POST /agent/respond`
- `GET /agent/responses?agent_id=...`

### Analytics & Transactions

- `GET /agent/transactions?agent_id=...`
- `GET /agent/developer/dashboard?agent_id=...`

### Legacy/compat routes (also available)

- `/api/register`, `/api/chat`, `/api/tools`, `/api/tool/{tool}`, `/api/pseudonym`, `/api/credits`, `/api/transactions`, `/api/developer/dashboard`

---

## Frontend Experience

Path: `MarketPlace/frontend`

- Create/load local agent identity (private seed remains in browser)
- Register agent on backend with public key
- Browse and execute skills from marketplace
- AI chat page routes prompt to best-matching skill (fallback to `research_api`)
- Publish your own skills + price
- Track credits, pseudonyms, transactions, and trust/cost dashboard metrics

---

## Security/Protocol Notes

The backend skill executor validates before execution:

- Required protocol envelope fields
- Agent ID consistency (`agentId == from_agent`)
- Schema version match
- Timestamp freshness window
- Nonce replay prevention
- Ed25519 signature verification on canonicalized envelope + payload

Only verified requests proceed to execution and settlement.

---

## Demo Seed Data

On backend startup, demo provider agents and manifests are seeded if provider data does not already exist:

- `weather_api`
- `crypto_api`
- `qr_api`
- `research_api`

---

## Development Commands

### Backend

```bash
cd MarketPlace/backend
go mod tidy
go run .
```

### Frontend

```bash
cd MarketPlace/frontend
npm install
npm run dev
npm run build
npm run preview
```

### SDK

```bash
cd agentic-identity-SDK
go run ./examples/demo-agent
```

---

## Notes

- This repository is currently a **prototype/demo implementation**.
- Several skills are mock executors intended for protocol and marketplace demonstration.
- Suitable next steps: persistent key management hardening, async execution queue, policy engine, and production-grade trust scoring.
