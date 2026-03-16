package agentid

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

// GenerateIdentity creates a new Agent identity in one call.
func GenerateIdentity() (*Agent, error) {
	a := New()
	if err := a.GenerateIdentity(); err != nil {
		return nil, err
	}
	return a, nil
}

// GenerateIdentity generates an ed25519 keypair and derives AgentID as:
// hex(sha256(public_key)).
func (a *Agent) GenerateIdentity() error {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return err
	}

	agentID := sha256.Sum256(pub)

	a.privateKey = append(ed25519.PrivateKey(nil), priv...)
	a.publicKey = append(ed25519.PublicKey(nil), pub...)
	a.agentID = hex.EncodeToString(agentID[:])
	return nil
}
