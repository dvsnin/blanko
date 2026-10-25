// presetsql печатает миграцию со строками готовых шаблонов: make presets-sql.
package main

import (
	"fmt"

	"github.com/dvsnin/blanko/backend/app/internal/preset"
)

func main() {
	fmt.Print(preset.MigrationSQL())
}
