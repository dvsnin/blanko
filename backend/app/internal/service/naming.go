package service

import "unicode/utf8"

const (
	nameMax    = 255
	copySuffix = " (копия)"
)

// duplicateName - имя копии доски или шаблона в пределах лимита колонки.
func duplicateName(name string) string {
	r := []rune(name)
	limit := nameMax - utf8.RuneCountInString(copySuffix)
	if len(r) > limit {
		r = r[:limit]
	}
	return string(r) + copySuffix
}
