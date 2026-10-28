// Цепочка parentId фигуры должна вести к странице. tldraw 5.5.2 при повторной вставке вложенных
// рамок замыкает её в кольцо, а на кольце `_shapeIdsInCurrentPage` крутится вечно: документ с кольцом
// открыть нельзя. Сервер такие патчи отклоняет и чинит документ при загрузке; здесь страховка на клиенте.

// repairParents переподчиняет участников колец первой странице (записи заменяются копиями)
// и возвращает их id. Хвост, ведущий в кольцо, и фигуры без родителя не трогаются.
export function repairParents(store) {
    let page = null;
    for (const id in store) {
        const r = store[id];
        if (r && r.typeName === "page" && (page === null || id < page)) page = id;
    }
    const parentOf = (id) => {
        const r = store[id];
        return r && r.typeName === "shape" ? String(r.parentId) : undefined;
    };
    const done = new Set();
    const fixed = [];
    for (const id of Object.keys(store).sort()) {
        if (parentOf(id) === undefined) continue;
        const path = [];
        let cur = id;
        while (!done.has(cur)) {
            const at = path.indexOf(cur);
            if (at >= 0) { fixed.push(...path.slice(at)); break; }
            path.push(cur);
            const p = parentOf(cur);
            if (p === undefined || !p.startsWith("shape:")) break;
            cur = p;
        }
        for (const m of path) done.add(m);
    }
    for (const id of fixed) store[id] = { ...store[id], parentId: page || "page:page" };
    return fixed.sort();
}
