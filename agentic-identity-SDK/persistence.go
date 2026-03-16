package agentid

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
)

// IdentityBundle is an explicit, portable representation of an identity.
// It is intentionally separate from Agent to avoid accidental private key exposure.
type IdentityBundle struct {
	// PrivateKeyHex is hex-encoded ed25519 private key bytes (64 bytes -> 128 hex chars).
	PrivateKeyHex string `json:"private_key_hex"`
	// PublicKeyHex is hex-encoded ed25519 public key bytes (32 bytes -> 64 hex chars).
	PublicKeyHex string `json:"public_key_hex"`
	// AgentID is hex(sha256(public_key)).
	AgentID string `json:"agent_id"`
	// Version allows forward-compatible migrations.
	Version int `json:"version"`
}

// ExportIdentity returns an IdentityBundle that can be serialized and stored.
func (a *Agent) ExportIdentity() (IdentityBundle, error) {
	if a == nil || len(a.privateKey) == 0 {
		return IdentityBundle{}, ErrMissingIdentity
	}
	if err := a.validateKeypair(); err != nil {
		return IdentityBundle{}, err
	}
	if a.agentID == "" {
		sum := sha256.Sum256(a.publicKey)
		a.agentID = hex.EncodeToString(sum[:])
	}

	return IdentityBundle{
		PrivateKeyHex: hex.EncodeToString(a.privateKey),
		PublicKeyHex:  hex.EncodeToString(a.publicKey),
		AgentID:       a.agentID,
		Version:       1,
	}, nil
}

// ImportIdentity replaces the agent's identity from a previously exported bundle.
func (a *Agent) ImportIdentity(b IdentityBundle) error {
	if a == nil {
		return errors.New("agent is nil")
	}
	if b.PrivateKeyHex == "" || b.PublicKeyHex == "" || b.AgentID == "" {
		return errors.New("identity bundle is incomplete")
	}

	priv, err := hex.DecodeString(b.PrivateKeyHex)
	if err != nil {
		return err
	}
	pub, err := hex.DecodeString(b.PublicKeyHex)
	if err != nil {
		return err
	}
	if len(priv) != ed25519.PrivateKeySize {
		return errors.New("invalid ed25519 private key in bundle")
	}
	if len(pub) != ed25519.PublicKeySize {
		return errors.New("invalid ed25519 public key in bundle")
	}

	// Validate bundle agent_id matches the provided public key.
	sum := sha256.Sum256(pub)
	expectedID := hex.EncodeToString(sum[:])
	if expectedID != b.AgentID {
		return errors.New("bundle agent_id does not match public key")
	}

	a.privateKey = append(ed25519.PrivateKey(nil), priv...)
	a.publicKey = append(ed25519.PublicKey(nil), pub...)
	a.agentID = b.AgentID

	return a.validateKeypair()
}

// Save writes the agent identity to a JSON file at path.
func (a *Agent) Save(path string) error {
	b, err := a.ExportIdentity()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(b, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

// Load reads an identity JSON file and returns an Agent.
func Load(path string) (*Agent, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var b IdentityBundle
	if err := json.Unmarshal(data, &b); err != nil {
		return nil, err
	}
	a := New()
	if err := a.ImportIdentity(b); err != nil {
		return nil, err
	}
	return a, nil
}

