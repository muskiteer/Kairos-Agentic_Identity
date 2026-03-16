package agentid

import (
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
)

var (
	ErrMissingIdentity = errors.New("agent identity is missing")
	ErrInvalidService  = errors.New("serviceID must be non-empty")
)

// generatePseudonym computes a service-specific pseudonym using:
// HMAC(master_secret, serviceID)
//
// This prevents linking the pseudonym back to the agent's stable identifier.
func generatePseudonym(a *Agent, serviceID string) (string, error) {
	if a == nil {
		return "", ErrMissingIdentity
	}
	if serviceID == "" {
		return "", ErrInvalidService
	}
	if len(a.privateKey) != ed25519.PrivateKeySize {
		return "", ErrMissingIdentity
	}

	// Use the ed25519 seed (32 bytes) as the HMAC key. This remains stable for the identity
	// and is not derivable from the public key.
	key := a.privateKey.Seed()

	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte("agentid:pseudonym:v1:"))
	_, _ = mac.Write([]byte(serviceID))
	sum := mac.Sum(nil)

	// Namespaced, log-friendly value. Full hex is 64 chars; keep it short but collision-resistant.
	hexSum := hex.EncodeToString(sum)
	return "ps_v1_" + hexSum[:24], nil
}
