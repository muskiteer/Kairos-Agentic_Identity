package agentid

import (
	"crypto/ed25519"
	"errors"
)

// VerifySignature verifies an ed25519 signature for data using pubKey.
func VerifySignature(pubKey ed25519.PublicKey, data []byte, signature []byte) bool {
	if len(pubKey) != ed25519.PublicKeySize {
		return false
	}
	return ed25519.Verify(pubKey, data, signature)
}

// VerifySignatureBytes is a convenience wrapper for APIs that provide raw key bytes.
func VerifySignatureBytes(pubKey []byte, data []byte, signature []byte) bool {
	if len(pubKey) != ed25519.PublicKeySize {
		return false
	}
	return VerifySignature(ed25519.PublicKey(pubKey), data, signature)
}

// signData signs data using an ed25519 private key.
func signData(privateKey ed25519.PrivateKey, data []byte) ([]byte, error) {
	if len(privateKey) != ed25519.PrivateKeySize {
		return nil, errors.New("invalid ed25519 private key length")
	}

	signature := ed25519.Sign(privateKey, data)
	return signature, nil
}

func (a *Agent) validateKeypair() error {
	if len(a.privateKey) != ed25519.PrivateKeySize {
		return errors.New("invalid ed25519 private key")
	}
	derived := a.privateKey.Public().(ed25519.PublicKey)
	if len(a.publicKey) != 0 && !ed25519.PublicKey(derived).Equal(a.publicKey) {
		return errors.New("public/private key mismatch")
	}
	// If public key wasn't set (e.g. loaded partially), hydrate it.
	if len(a.publicKey) == 0 {
		a.publicKey = append(ed25519.PublicKey(nil), derived...)
	}
	return nil
}
