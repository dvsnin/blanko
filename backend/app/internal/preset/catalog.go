package preset

// Catalog - все предустановленные шаблоны по темам. Ключ (Key) неизменяем: по нему сидер
// находит строку и документ.
func Catalog() []Preset {
	var out []Preset
	for _, part := range [][]Preset{
		mathPresets(), literacyPresets(), worldPresets(), speechPresets(), logicPresets(),
		drawingPresets(), sensoryPresets(), routinePresets(), musicPresets(), healthPresets(),
		safetyPresets(), socialPresets(),
	} {
		out = append(out, part...)
	}
	return out
}
