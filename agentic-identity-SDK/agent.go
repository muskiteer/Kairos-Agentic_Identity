package agentid

import (
	"crypto/ed25519"
	"encoding/hex"
	"errors"
)

// Agent holds an agent's long-lived cryptographic identity.
//
// The private key is intentionally unexported to prevent accidental leakage.
type Agent struct {
	privateKey ed25519.PrivateKey
	publicKey  ed25519.PublicKey
	agentID    string // hex(sha256(publicKey))
}

// New creates an empty agent that can load or generate identity later.
func New() *Agent { return &Agent{} }

// ID returns the stable AgentID string (hex-encoded sha256(publicKey)).
func (a *Agent) ID() string { return a.agentID }

// GetAgentID is kept for ergonomic parity with earlier drafts.
func (a *Agent) GetAgentID() string { return a.agentID }

// PublicKey returns a copy of the agent public key.
func (a *Agent) PublicKey() ed25519.PublicKey {
	if len(a.publicKey) == 0 {
		return nil
	}
	return append(ed25519.PublicKey(nil), a.publicKey...)
}

// PublicKeyHex returns the public key encoded as hex for APIs/logging.
func (a *Agent) PublicKeyHex() string {
	if len(a.publicKey) == 0 {
		return ""
	}
	return hex.EncodeToString(a.publicKey)
}

// GeneratePseudonym derives a service-specific pseudonym for serviceID.
func (a *Agent) GeneratePseudonym(serviceID string) (string, error) {
	return generatePseudonym(a, serviceID)
}

// SignRequest signs input data using the agent's private key.
func (a *Agent) SignRequest(data []byte) ([]byte, error) {
	if len(a.privateKey) == 0 {
		return nil, errors.New("private key is missing")
	}
	if err := a.validateKeypair(); err != nil {
		return nil, err
	}
	return signData(a.privateKey, data)
}
