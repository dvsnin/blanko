package storage

import (
	"context"
	"fmt"
)

// DeletePrefix удаляет все объекты из-под prefix.
func DeletePrefix(ctx context.Context, st ObjectStore, prefix string) error {
	keys, err := st.List(ctx, prefix)
	if err != nil {
		return fmt.Errorf("list %s: %w", prefix, err)
	}
	if len(keys) == 0 {
		return nil
	}
	return st.Delete(ctx, keys...)
}
