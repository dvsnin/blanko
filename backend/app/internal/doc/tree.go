package doc

import (
	"encoding/json"
	"sort"
	"strings"
)

// Дерево фигур: parentId ведёт к странице. Кольцо родителей вешает tldraw навсегда
// (`_shapeIdsInCurrentPage` идёт вверх по parentId без защиты), а tldraw 5.5.2 сам замыкает
// кольцо при повторной вставке вложенных рамок. Комната такие патчи отклоняет (ErrCycle),
// а документ с кольцом чинит при загрузке: участники кольца уходят на первую страницу.

// shapeParent - parentId записи-фигуры; ok=false для остальных записей и мусора.
func shapeParent(raw json.RawMessage) (string, bool) {
	var h struct {
		TypeName string `json:"typeName"`
		ParentID string `json:"parentId"`
	}
	if json.Unmarshal(raw, &h) != nil || h.TypeName != "shape" {
		return "", false
	}
	return h.ParentID, true
}

func isShapeID(id string) bool { return strings.HasPrefix(id, "shape:") }

// findCycle идёт от start вверх по parent. done - фигуры, чья цепочка уже проверена;
// пройденные дописываются туда, чтобы общий обход был линейным. Страница или отсутствующий
// родитель завершают путь без кольца: родитель может прийти следующим чанком.
// Возвращает участников кольца или nil.
func findCycle(start string, parent func(string) (string, bool), done map[string]struct{}) []string {
	var path []string
	for id := start; ; {
		if _, ok := done[id]; ok {
			break
		}
		for i, seen := range path {
			if seen == id {
				return path[i:]
			}
		}
		path = append(path, id)
		p, ok := parent(id)
		if !ok || !isShapeID(p) {
			break
		}
		id = p
	}
	for _, id := range path {
		done[id] = struct{}{}
	}
	return nil
}

// cycleMembers - все фигуры, стоящие в кольцах; отсортированы для детерминизма.
func cycleMembers(parents map[string]string) []string {
	lookup := func(id string) (string, bool) { p, ok := parents[id]; return p, ok }
	done := make(map[string]struct{}, len(parents))
	var members []string
	for id := range parents {
		for _, m := range findCycle(id, lookup, done) {
			members = append(members, m)
			done[m] = struct{}{}
		}
	}
	sort.Strings(members)
	return members
}

// withParent переписывает parentId записи, остальные поля остаются байт в байт.
func withParent(raw json.RawMessage, parent string) (json.RawMessage, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, err
	}
	fields["parentId"], _ = json.Marshal(parent)
	return json.Marshal(fields)
}
