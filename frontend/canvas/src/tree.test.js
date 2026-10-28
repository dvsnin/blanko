import { describe, expect, it } from "vitest";
import { repairParents } from "./tree.js";

const rec = (id, parentId, typeName = "shape") => ({ id, typeName, parentId, props: { w: 1 } });

describe("repairParents", () => {
    it("переподчиняет странице участников кольца, хвост и остальное не трогает", () => {
        const store = {
            "page:p2": { id: "page:p2", typeName: "page" },
            "page:p1": { id: "page:p1", typeName: "page" },
            "shape:a": rec("shape:a", "shape:c"),
            "shape:b": rec("shape:b", "shape:a"),
            "shape:c": rec("shape:c", "shape:b"),
            "shape:tail": rec("shape:tail", "shape:b"),
            "shape:ok": rec("shape:ok", "page:p1"),
            "shape:orphan": rec("shape:orphan", "shape:gone"),
            "shape:self": rec("shape:self", "shape:self"),
        };
        expect(repairParents(store)).toEqual(["shape:a", "shape:b", "shape:c", "shape:self"]);
        expect(store["shape:a"].parentId).toBe("page:p1");
        expect(store["shape:b"].parentId).toBe("page:p1");
        expect(store["shape:c"].parentId).toBe("page:p1");
        expect(store["shape:self"].parentId).toBe("page:p1");
        expect(store["shape:a"].props).toEqual({ w: 1 });
        expect(store["shape:tail"].parentId).toBe("shape:b");
        expect(store["shape:orphan"].parentId).toBe("shape:gone");
        expect(store["shape:ok"].parentId).toBe("page:p1");
    });

    it("без цикла ничего не меняет", () => {
        const store = { "page:p": { id: "page:p", typeName: "page" }, "shape:a": rec("shape:a", "page:p"), "shape:b": rec("shape:b", "shape:a") };
        const before = JSON.stringify(store);
        expect(repairParents(store)).toEqual([]);
        expect(JSON.stringify(store)).toBe(before);
    });

    it("без записи страницы использует page:page", () => {
        const store = { "shape:a": rec("shape:a", "shape:b"), "shape:b": rec("shape:b", "shape:a") };
        repairParents(store);
        expect(store["shape:a"].parentId).toBe("page:page");
    });
});
