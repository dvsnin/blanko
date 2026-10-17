package repository

import (
	"crypto/rand"
	"encoding/hex"
)

// newPublicID: prefix + 16 hex. Доски без префикса, шаблоны с "t".
func newPublicID(prefix string) (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buf), nil
}
