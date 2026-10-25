// Холст Blanko на tldraw. Собирается Vite (frontend/canvas) в backend/app/static/canvas/assets:
// tldraw, React, стили и ресурсы редактора лежат в статике бэкенда, интернет канвасу не нужен.
// Содержимое документа живёт на сервере: вебсокет /app/ws/{kind}/{id}, диффы записей туда и обратно,
// IndexedDB не используется. Протокол: docs/superpowers/specs/2026-10-24-board-storage-ws-design.md.
import React from "react";
import { createRoot } from "react-dom/client";
import {
    Tldraw, createTLStore, getSnapshot, loadSnapshot, defaultShapeUtils, defaultBindingUtils,
    InstancePresenceRecordType, USER_COLORS,
} from "tldraw";
import { getAssetUrlsByImport } from "@tldraw/assets/imports.vite";
import "tldraw/tldraw.css";

// Шрифты, иконки и переводы tldraw из бандла, а не с cdn.tldraw.com.
const assetUrls = getAssetUrlsByImport();

// tldraw 3.15.3 - последняя версия без лицензионного ключа; с 4.0 без ключа
// холст гаснет (в том числе на *.localhost). Апгрейд только с TLDRAW_LICENSE_KEY.
// Watermark "made with tldraw" скрывать нельзя.
const licenseKey = window.TLDRAW_LICENSE_KEY || undefined;

// APP_DOC инжектит сервер: kind, id (uuid), publicId, canEdit.
const APP_DOC = window.APP_DOC || { kind: "board", id: "", publicId: "", canEdit: true };
const profileName = (window.dashData && window.dashData.name) ? String(window.dashData.name) : "User";

// Копирует ссылку на документ; подтверждение рядом с кнопкой, без модального окна.
document.getElementById("shareBtn").addEventListener("click", async () => {
    const hint = document.getElementById("shareHint");
    const show = (text) => {
        hint.textContent = text;
        hint.classList.add("is-visible");
        setTimeout(() => hint.classList.remove("is-visible"), 2500);
    };
    try {
        await navigator.clipboard.writeText(window.location.href);
        show("Ссылка скопирована");
    } catch {
        show("Скопируйте адрес из строки браузера");
    }
});

// --- медиа: файлы лежат в хранилище под префиксом документа, src самодостаточный ---
const assets = {
    async upload(asset, file) {
        const fd = new FormData();
        fd.append("file", file, file.name);
        const res = await fetch(`/app/media/${APP_DOC.kind}/${APP_DOC.id}`, { method: "POST", body: fd, credentials: "include" });
        if (!res.ok) throw new Error("upload failed: " + res.status);
        return { src: (await res.json()).src };
    },
    resolve(asset) {
        const src = asset.props.src;
        return src && src.startsWith("asset:") ? "/app/media/" + src.slice("asset:".length) : src;
    },
};

const store = createTLStore({ assets, shapeUtils: defaultShapeUtils, bindingUtils: defaultBindingUtils });

// --- состояние соединения ---
const statusEl = document.getElementById("saveState");
const overlay = {
    root: document.getElementById("overlay"),
    spinner: document.getElementById("overlaySpinner"),
    title: document.getElementById("overlayTitle"),
    text: document.getElementById("overlayText"),
    retry: document.getElementById("overlayRetry"),
};
const docWord = APP_DOC.kind === "template" ? "шаблон" : "доску";
if (APP_DOC.kind === "template") {
    document.getElementById("backLink").href = "/app/dashboard#/templates";
    document.getElementById("backLabel").textContent = "Шаблоны";
}
let offlineTimer = null;   // оверлей «Нет связи» показываем с задержкой, чтобы не мигал на мгновенных обрывах
let reconnectTimer = null;
const sessionKey = `blanko-session-${APP_DOC.kind}-${APP_DOC.id}`;
let editor = null;
let ws = null;
let canEdit = false;
let gotInit = false;        // первый init применён
let seq = 0;
let attempt = 0;
let sendScheduled = false;
let ackTimer = null;
const pending = { put: new Map(), remove: new Set() };
const inflight = new Map();  // seq -> сообщение push без ack

function isConnected() {
    return !!ws && ws.readyState === WebSocket.OPEN && gotInit;
}

function setStatus() {
    let text;
    if (!ws || ws.readyState !== WebSocket.OPEN) text = (gotInit || attempt > 0) ? "Нет связи" : "Загрузка";
    else if (!gotInit) text = "Загрузка";
    else if (pending.put.size || pending.remove.size || inflight.size) text = "Сохраняется";
    else text = "Сохранено";
    if (statusEl && statusEl.textContent !== text) statusEl.textContent = text;
}

// Холст редактируется только при живом соединении и праве записи: до init и при обрыве
// правки не принимаются, иначе их стёр бы loadSnapshot или они бы зависли без отправки.
function applyReadonly() {
    if (!editor) return;
    try { editor.updateInstanceState({ isReadonly: !(canEdit && isConnected()) }); } catch {}
}

function showOverlay(kind) {
    const o = overlay;
    if (kind === "hidden") { o.root.hidden = true; return; }
    o.root.hidden = false;
    o.spinner.hidden = kind === "deleted";
    o.retry.hidden = kind !== "offline";
    if (kind === "loading") {
        o.title.textContent = `Загружаем ${docWord}`;
        o.text.textContent = "Подключаемся к серверу";
    } else if (kind === "offline") {
        o.title.textContent = "Нет связи";
        o.text.textContent = attempt > 1 ? `Переподключаемся, попытка ${attempt}` : "Переподключаемся";
    } else if (kind === "deleted") {
        o.title.textContent = APP_DOC.kind === "template" ? "Шаблон удалён" : "Доска удалена";
        o.text.textContent = "Закройте вкладку";
    } else if (kind === "denied") {
        o.spinner.hidden = true;
        o.title.textContent = "Доступ закрыт";
        o.text.textContent = "Владелец изменил доступ к этой доске";
    } else if (kind === "failed") {
        o.retry.hidden = false;
        o.spinner.hidden = true;
        o.title.textContent = `Не удалось загрузить ${docWord}`;
        o.text.textContent = "Сервер не смог прочитать документ. Попробуйте ещё раз или сообщите администратору";
    }
}

function scheduleOfflineOverlay() {
    if (offlineTimer) return;
    offlineTimer = setTimeout(() => { offlineTimer = null; if (!isConnected()) showOverlay("offline"); }, 1000);
}

function clearOfflineOverlay() {
    if (offlineTimer) { clearTimeout(offlineTimer); offlineTimer = null; }
    showOverlay("hidden");
}

overlay.retry.addEventListener("click", () => {
    if (ws) return;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    overlay.text.textContent = "Подключаемся";
    connect();
});

// Закрытие вкладки с неотправленными правками: браузер спросит подтверждение.
window.addEventListener("beforeunload", (e) => {
    if (pending.put.size || pending.remove.size || inflight.size) {
        e.preventDefault();
        e.returnValue = "";
    }
});

function readSession() {
    try { return JSON.parse(localStorage.getItem(sessionKey) || "null") || undefined; } catch { return undefined; }
}
let sessionTimer = null;
function saveSessionThrottled() {
    if (sessionTimer) return;
    sessionTimer = setTimeout(() => {
        sessionTimer = null;
        try { localStorage.setItem(sessionKey, JSON.stringify(getSnapshot(editor.store).session)); } catch {}
    }, 1000);
}

// Первую страницу tldraw заводит с именем "Page 1" без перевода (это не UI-строка, а запись в схеме);
// страницы из меню уже «Страница N». Переименовываем только точное дефолтное имя и только с правом записи.
function localizeDefaultPage() {
    for (const page of editor.getPages()) {
        if (page.name === "Page 1") editor.updatePage({ id: page.id, name: "Страница 1" });
    }
}

function emptyDocument() {
    return { schema: editor.store.schema.serialize(), store: {} };
}

// --- presence: свой курсор и камера остальным, чужие курсоры к себе в store ---
// userId свой на вкладку: два окна одного человека - два курсора.
const presenceUserId = "u-" + Math.random().toString(36).slice(2, 10);
const presenceRecordId = InstancePresenceRecordType.createId(presenceUserId);
// Цвет курсора и кружка - по id аккаунта: один педагог одного цвета с любого устройства, а не
// случайный на каждую вкладку. Палитра tldraw из семи цветов, при большем числе людей совпадения неизбежны.
function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
const colorSeed = (window.dashData && window.dashData.accountId) ? String(window.dashData.accountId) : presenceUserId;
const presenceColor = USER_COLORS[hashString(colorSeed) % USER_COLORS.length];
let presenceTimer = null;
let lastPresenceJson = "";

function schedulePresence() {
    if (presenceTimer) return;
    presenceTimer = setTimeout(() => { presenceTimer = null; sendPresence(); }, 50);
}

function sendPresence() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !gotInit || !editor) return;
    let record;
    try {
        const point = editor.inputs.currentPagePoint;
        const camera = editor.getCamera();
        const bounds = editor.getViewportScreenBounds();
        record = InstancePresenceRecordType.create({
            id: presenceRecordId,
            userId: presenceUserId,
            userName: profileName,
            color: presenceColor,
            currentPageId: editor.getCurrentPageId(),
            cursor: { x: point.x, y: point.y, type: "default", rotation: 0 },
            camera: { x: camera.x, y: camera.y, z: camera.z },
            screenBounds: { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
            followingUserId: editor.getInstanceState().followingUserId || null,
            // Выделение и рамка выделения видны остальным: "фигура занята, с ней работают".
            selectedShapeIds: editor.getSelectedShapeIds(),
            brush: editor.getInstanceState().brush || null,
            scribbles: editor.getInstanceState().scribbles || [],
            chatMessage: "",
            lastActivityTimestamp: Date.now(),
        });
    } catch (e) {
        return;
    }
    // Без активности не шлём: timestamp не считается изменением, курсор у остальных гаснет сам.
    const comparable = JSON.stringify({ ...record, lastActivityTimestamp: 0 });
    if (comparable === lastPresenceJson) return;
    lastPresenceJson = comparable;
    ws.send(JSON.stringify({ type: "presence", record }));
}

function onPresence(msg) {
    const rec = msg.record;
    if (!rec || rec.typeName !== "instance_presence" || rec.id === presenceRecordId) return;
    try {
        editor.store.mergeRemoteChanges(() => editor.store.put([rec]));
    } catch (e) {
        console.warn("presence apply:", e);
    }
}

function onPresenceGone(msg) {
    if (!msg.id || !editor || !editor.store.has(msg.id)) return;
    try { editor.store.mergeRemoteChanges(() => editor.store.remove([msg.id])); } catch {}
}

// При обрыве связи чужие курсоры заведомо мертвы - убираем, бэклог придёт с новым init.
function clearRemotePresence() {
    if (!editor) return;
    const ids = editor.store.allRecords().filter((r) => r.typeName === "instance_presence").map((r) => r.id);
    if (!ids.length) return;
    try { editor.store.mergeRemoteChanges(() => editor.store.remove(ids)); } catch {}
}

// Участники в шапке вместо панели tldraw: кнопка со своим кружком и числом подключений, по клику
// список (одно подключение - одна строка: ноутбук и панель одного педагога это два участника).
// Клик по строке - режим «следовать», ещё клик - перестать. Кто на другой странице - помечен.
let peopleOpen = false;
let peopleScheduled = false;
function schedulePeople() {
    if (peopleScheduled) return;
    peopleScheduled = true;
    requestAnimationFrame(() => { peopleScheduled = false; renderPeople(); });
}
function initialOf(name) { return (name || "?").trim().charAt(0).toUpperCase() || "?"; }
function avatarEl(color, name) {
    const el = document.createElement("span");
    el.className = "people__avatar";
    el.style.backgroundColor = color;
    el.textContent = initialOf(name);
    el.setAttribute("aria-hidden", "true");
    return el;
}
function setPeopleOpen(open) {
    if (peopleOpen === open) return;
    peopleOpen = open;
    renderPeople();
}
// Фаза перехвата: tldraw гасит всплытие pointerdown с холста, иначе клик по доске список не закрывал бы.
document.addEventListener("pointerdown", (e) => {
    if (peopleOpen && !document.getElementById("people").contains(e.target)) setPeopleOpen(false);
}, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && peopleOpen) setPeopleOpen(false); });

function renderPeople() {
    const root = document.getElementById("people");
    if (!root || !editor) return;
    const pageId = editor.getCurrentPageId();
    const followingUserId = editor.getInstanceState().followingUserId || null;
    const peers = editor.store.query.records("instance_presence").get()
        .filter((p) => p.id !== presenceRecordId)
        .sort((a, b) => Number(b.currentPageId === pageId) - Number(a.currentPageId === pageId) || (a.userName || "").localeCompare(b.userName || "", "ru"));
    const total = peers.length + 1;
    root.replaceChildren();

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "people__trigger";
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", String(peopleOpen));
    trigger.title = total === 1 ? "На доске только вы" : `На доске: ${total}`;
    trigger.appendChild(avatarEl(presenceColor, profileName));
    const count = document.createElement("span");
    count.className = "people__count";
    count.textContent = String(total);
    trigger.appendChild(count);
    trigger.addEventListener("click", () => setPeopleOpen(!peopleOpen));
    root.appendChild(trigger);
    if (!peopleOpen) return;

    const pop = document.createElement("div");
    pop.className = "people__pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Участники на доске");
    const title = document.createElement("div");
    title.className = "people__title";
    title.textContent = total === 1 ? "На доске только вы" : `На доске: ${total}`;
    pop.appendChild(title);

    const row = (color, name, meta, opts) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "people__row" + (opts.following ? " people__row--following" : "") + (opts.away ? " people__row--away" : "");
        if (opts.disabled) el.disabled = true;
        el.appendChild(avatarEl(color, name));
        const who = document.createElement("span");
        who.className = "people__who";
        const n = document.createElement("span"); n.className = "people__name"; n.textContent = name;
        const m = document.createElement("span"); m.className = "people__meta"; m.textContent = meta;
        who.appendChild(n); who.appendChild(m);
        el.appendChild(who);
        if (opts.follow) {
            const f = document.createElement("span");
            f.className = "people__follow";
            f.textContent = opts.following ? "Следуете" : "Следовать";
            el.appendChild(f);
        }
        return el;
    };
    pop.appendChild(row(presenceColor, profileName, "Это вы", { disabled: true }));
    peers.forEach((p) => {
        const away = p.currentPageId !== pageId;
        const following = followingUserId === p.userId;
        const el = row(p.color, p.userName || "Участник", away ? "На другой странице" : "На этой странице", { follow: true, following, away });
        el.addEventListener("click", () => {
            try {
                if (following) editor.stopFollowingUser();
                else editor.startFollowingUser(p.userId);
            } catch (e) { console.warn("follow:", e); }
            schedulePeople();
        });
        pop.appendChild(el);
    });
    root.appendChild(pop);
}

// Панель участников tldraw не нужна: список живёт в шапке.
const uiComponents = { SharePanel: null };

// --- отправка: всё, что накопилось за кадр, уходит одним push ---
function onChange(entry) {
    const { added, updated, removed } = entry.changes;
    for (const rec of Object.values(added)) { pending.put.set(rec.id, rec); pending.remove.delete(rec.id); }
    for (const [, to] of Object.values(updated)) { pending.put.set(to.id, to); pending.remove.delete(to.id); }
    for (const rec of Object.values(removed)) { pending.remove.add(rec.id); pending.put.delete(rec.id); }
    scheduleSend();
}

function scheduleSend() {
    setStatus();
    if (sendScheduled) return;
    sendScheduled = true;
    requestAnimationFrame(() => { sendScheduled = false; flushPending(); });
}

// Один push не больше pushChunkBytes: лимит сервера 16 МиБ, запас на схему и служебные поля.
const pushChunkBytes = 4 * 1024 * 1024;

function flushPending() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !gotInit || !canEdit) return;
    if (!pending.put.size && !pending.remove.size) return;
    const schema = editor.store.schema.serialize();
    const entries = [...pending.put.entries()];
    const remove = [...pending.remove];
    pending.put.clear(); pending.remove.clear();
    let put = {}, size = 0;
    const send = (chunkPut, chunkRemove) => {
        const msg = { type: "push", seq: ++seq, schema, put: chunkPut, remove: chunkRemove };
        inflight.set(msg.seq, msg);
        ws.send(JSON.stringify(msg));
    };
    for (const [id, rec] of entries) {
        const len = JSON.stringify(rec).length;
        if (size && size + len > pushChunkBytes) { send(put, []); put = {}; size = 0; }
        put[id] = rec; size += len;
    }
    send(put, remove);
    armAckTimer();
    setStatus();
}

// Таймер измеряет тишину сервера: перевзводится на каждом ack, пока есть неподтверждённые push.
// При непрерывном рисовании inflight не пустеет, но ack идут, и соединение живо.
function armAckTimer() {
    if (ackTimer) clearTimeout(ackTimer);
    ackTimer = null;
    if (!inflight.size) return;
    ackTimer = setTimeout(() => {
        ackTimer = null;
        if (inflight.size && ws) { try { ws.close(); } catch {} }
    }, 10000);
}

function onAck(msg) {
    inflight.delete(msg.seq);
    armAckTimer();
    setStatus();
}

// Записи с локальной неподтверждённой правкой из patch пропускаем: сервер применил чужую
// правку раньше нашей, итог у него наш, и после ack все клиенты сходятся.
function locallyDirtyIds() {
    const ids = new Set([...pending.put.keys(), ...pending.remove]);
    for (const m of inflight.values()) {
        for (const id of Object.keys(m.put || {})) ids.add(id);
        for (const id of m.remove || []) ids.add(id);
    }
    return ids;
}

function onPatch(msg) {
    const dirty = locallyDirtyIds();
    const put = Object.values(msg.put || {}).filter((rec) => !dirty.has(rec.id));
    const remove = (msg.remove || []).filter((id) => !dirty.has(id) && editor.store.has(id));
    if (!put.length && !remove.length) return;
    editor.store.mergeRemoteChanges(() => {
        if (put.length) editor.store.put(put);
        if (remove.length) editor.store.remove(remove);
    });
}

// Переподключение: сервер главный, свои несохранённые правки докладываем поверх.
function onInit(msg) {
    canEdit = !!msg.canEdit;
    const firstInit = !gotInit;
    if (!gotInit) {
        if (msg.document) loadSnapshot(editor.store, { document: msg.document, session: readSession() });
        gotInit = true;
        editor.store.listen(saveSessionThrottled, { scope: "session" });
        // Камера и указатель живут в session-записях: этого хватает как триггера presence.
        editor.store.listen(schedulePresence, { scope: "session" });
        if (canEdit) {
            editor.store.listen(onChange, { source: "user", scope: "document" });
            if (!msg.document) {
                // Пустая комната: отдать дефолтные записи (document, page), чтобы сервер их знал.
                for (const rec of Object.values(getSnapshot(editor.store).document.store)) pending.put.set(rec.id, rec);
            }
        }
    } else {
        const session = getSnapshot(editor.store).session;
        const mine = [...inflight.values()];
        inflight.clear();
        editor.store.mergeRemoteChanges(() => {
            loadSnapshot(editor.store, { document: msg.document || emptyDocument(), session });
            for (const m of mine) {
                const put = Object.values(m.put || {});
                if (put.length) editor.store.put(put);
                if (m.remove && m.remove.length) editor.store.remove(m.remove.filter((id) => editor.store.has(id)));
            }
            const put = [...pending.put.values()];
            if (put.length) editor.store.put(put);
            const rem = [...pending.remove].filter((id) => editor.store.has(id));
            if (rem.length) editor.store.remove(rem);
        });
        for (const m of mine) {
            for (const rec of Object.values(m.put || {})) { pending.put.set(rec.id, rec); pending.remove.delete(rec.id); }
            for (const id of m.remove || []) { pending.remove.add(id); pending.put.delete(id); }
        }
    }
    attempt = 0;
    clearOfflineOverlay();
    applyReadonly();
    // Только после снятия readonly: в режиме чтения tldraw молча игнорирует updatePage.
    if (firstInit && canEdit) localizeDefaultPage();
    // Первое открытие на этом устройстве: показать всё содержимое целиком (шаблоны занятий
    // сделаны под панель 1920 px, на ноутбуке без подгонки видна только часть).
    if (firstInit && !readSession() && editor.getCurrentPageShapeIds().size > 0) editor.zoomToFit({ animation: { duration: 0 } });
    scheduleSend();
    // Сервер после реконнекта нас не помнит - представляемся заново.
    lastPresenceJson = "";
    schedulePresence();
}

function connect() {
    const proto = location.protocol === "https:" ? "wss://" : "ws://";
    ws = new WebSocket(`${proto}${location.host}/app/ws/${APP_DOC.kind}/${APP_DOC.id}`);
    ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === "init") onInit(msg);
        else if (msg.type === "ack") onAck(msg);
        else if (msg.type === "patch") onPatch(msg);
        else if (msg.type === "presence") onPresence(msg);
        else if (msg.type === "presence_gone") onPresenceGone(msg);
        else if (msg.type === "error") console.warn("ws error:", msg.code);
    };
    ws.onclose = (ev) => {
        ws = null;
        if (ackTimer) { clearTimeout(ackTimer); ackTimer = null; }
        clearRemotePresence();
        applyReadonly();
        setStatus();
        if (ev.code === 4404) { statusEl.textContent = "Документ удалён"; showOverlay("deleted"); return; }
        if (ev.code === 4403) { statusEl.textContent = "Доступ закрыт"; showOverlay("denied"); return; }
        // 1011: сервер не смог загрузить документ, 1009: наше сообщение больше лимита.
        // Автоматический реконнект тут бессмыслен: повторится то же самое.
        if (ev.code === 1011 || ev.code === 1009) { attempt++; showOverlay("failed"); return; }
        attempt++;
        if (gotInit) scheduleOfflineOverlay();
        const delay = Math.min(10000, 1000 * Math.pow(2, attempt - 1));
        reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
    };
    ws.onerror = () => { try { ws && ws.close(); } catch {} };
}

createRoot(document.getElementById("tldraw-root")).render(
    React.createElement(Tldraw, {
        licenseKey,
        store,
        assetUrls,
        components: uiComponents,
        onMount: (ed) => {
            editor = ed;
            window.blankoEditor = ed; // для проверок со стенда из консоли
            // locale фиксируем явно: по умолчанию tldraw берёт язык из navigator.languages.
            try { editor.user.updateUserPreferences({ name: profileName, locale: "ru", color: presenceColor }); } catch {}
            applyReadonly(); // до init холст только для чтения
            showOverlay("loading");
            setStatus();
            // Список участников: чужие presence-записи и своя страница/режим «следовать».
            editor.store.listen(schedulePeople, { scope: "presence" });
            editor.store.listen(schedulePeople, { scope: "session" });
            renderPeople();
            connect();
        },
    }),
);
