// presetsql печатает миграцию со строками готовых шаблонов из каталога internal/preset.
// Запуск: make presets-sql (перезаписывает backend/app/migration/*_presets.sql).
package main

import (
	"fmt"

	"github.com/dvsnin/blanko/backend/app/internal/preset"
)

func main() {
	fmt.Print(preset.MigrationSQL())
}
