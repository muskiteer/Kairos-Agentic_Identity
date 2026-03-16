## AgentID SDK (Go)

Small SDK for AI agents to:

- Generate a cryptographic identity (ed25519)
- Derive service-specific pseudonyms (HMAC-based)
- Sign requests
- Verify signatures
- Persist identity across runs (export/import JSON)

### Quickstart

```bash
cd agentic-identity-SDK
go run ./examples/demo-agent
```

### Minimal API

- `func New() *Agent`
- `func GenerateIdentity() (*Agent, error)`
- `func (a *Agent) GenerateIdentity() error`
- `func (a *Agent) ID() string`
- `func (a *Agent) GeneratePseudonym(serviceID string) (string, error)`
- `func (a *Agent) SignRequest(data []byte) ([]byte, error)`
- `func VerifySignature(pubKey ed25519.PublicKey, data, sig []byte) bool`

### Persistence

- `func (a *Agent) Save(path string) error`
- `func Load(path string) (*Agent, error)`
