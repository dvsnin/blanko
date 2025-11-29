import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import "./Boards.css";
import "./Boards.colors.css";
import "./BoardMenu.css";
import "./Boards.modals.css";
import "./Boards.list.css";
import "./StarButton.css";
import StarButton from "./StarButton";
import MenuButton from "./MenuButton";
import ProfileMenu from "./ProfileMenu";
import ProfileModal from "./ProfileModal";
import MenuPortal from "./MenuPortal";
import NotificationsPanel from "./NotificationsPanel";
import TemplatesIsland from "./TemplatesIsland";
import NotificationButton from "./NotificationButton";
import ProfileButton from "./ProfileButton";
import ViewToggle from "./ViewToggle";

const colorKeys = [
    "mintBlue","peach","lilac","aqua","sunset","grass","ocean","berry","grape","night",
    "lava","sky","forest","lemon","rose","steel","sand","teal","freshMint","indigo",
];

function pickAvailableColorFrom(boards) {
    const used = new Set(boards.map((b) => b.colorKey).filter(Boolean));
    for (const key of colorKeys) {
        if (!used.has(key)) return key;
    }
    return colorKeys[boards.length % colorKeys.length];
}

function assignColorsToInitial(list) {
    const out = [];
    const used = new Set();
    for (let i = 0; i < list.length; i++) {
        const b = { ...list[i] };
        if (!b.colorKey) {
            const available = colorKeys.find((k) => !used.has(k));
            b.colorKey = available || colorKeys[i % colorKeys.length];
        }
        used.add(b.colorKey);
        out.push(b);
    }
    return out;
}

const rawBoards = [
    { id: 1, title: "МояПикерДоска", owner: "Дмитрий Васнянин", updated: "14 ноября", lastOpened: "14 ноября", onlineUsers: 3 },
    { id: 2, title: "Маркетинг 2025", owner: "Дмитрий Васнянин", updated: "12 ноября", lastOpened: "12 ноября", onlineUsers: 1 },
    { id: 3, title: "Roadmap SyncBoard", owner: "Дмитрий Васнянин", updated: "10 ноября", lastOpened: "10 ноября", onlineUsers: 0 },
    { id: 4, title: "Учебный проект", owner: "Дмитрий Васнянин", updated: "8 ноября", lastOpened: "8 ноября", onlineUsers: 2 },
    { id: 5, title: "Личное планирование", owner: "Дмитрий Васнянин", updated: "7 ноября", lastOpened: "7 ноября", onlineUsers: 0 },
    { id: 6, title: "Личное", owner: "Дмитрий Васнянин", updated: "12 декабря", lastOpened: "12 декабря", onlineUsers: 0 },
    { id: 7, title: "Финансы", owner: "Дмитрий Васнянин", updated: "13 декабря", lastOpened: "13 декабря", onlineUsers: 0 },
];

const initialBoards = assignColorsToInitial(rawBoards);

/* ---------- openBoardWindow helper (mock board in new tab) ----------
   - loads /realtime/mockSocketClient.js
*/
function openBoardWindow(board) {
    const w = window.open("", "_blank");
    if (!w) {
        alert("Пожалуйста, разрешите всплывающие окна для этого сайта.");
        return;
    }

    const openerName = (typeof window !== "undefined" && window.dashData && window.dashData.name) ? String(window.dashData.name) : "";
    const initialCharRaw = openerName ? openerName.trim().charAt(0) : "U";
    const initialChar = initialCharRaw ? initialCharRaw.toUpperCase() : "U";

    const safeTitle = String(board.title || "Доска").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeInitial = String(initialChar).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const socketScriptUrl = "/realtime/mockSocketClient.js";

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeTitle}</title>
<style>
  html,body{height:100%;margin:0;font-family:Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial;}
  body{background:#f3f6f9;overflow:hidden}
  .thin-top{height:8px;background:linear-gradient(90deg,#1f8a3f,#0d6b2c);box-shadow:0 2px 0 rgba(0,0,0,0.06)}
  .topbar{height:56px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;box-shadow:0 1px 0 rgba(15,23,42,0.04);z-index:40}
  .brand-row{display:flex;align-items:center;gap:12px}
  .logo-text{font-weight:800;font-size:20px;color:#0f1724;letter-spacing:-0.5px}
  .board-meta{display:flex;align-items:center;gap:10px}
  .meta-icon{width:36px;height:36px;border-radius:8px;background:#f3f4f6;display:inline-flex;align-items:center;justify-content:center;box-shadow:inset 0 -4px rgba(0,0,0,0.02);}
  .board-name{font-size:16px;font-weight:700;color:#0f1724}
  .dots-btn{width:44px;height:44px;border-radius:10px;background:transparent;border:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#0f1724}
  .top-actions{display:flex;gap:12px;align-items:center}
  .wrap{display:flex;flex:1;height:calc(100% - 64px);position:relative}
  .leftbar{width:72px;padding:12px 8px;display:flex;flex-direction:column;gap:10px;align-items:center}
  .tool{width:46px;height:46px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(2,6,23,0.06);cursor:pointer;margin:8px 0}
  .canvas-area{flex:1;position:relative;overflow:hidden;background:#fbfcfd}
  .grid{position:absolute;inset:0;background-image:
    linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px);
    background-size:48px 48px;opacity:.65;z-index:1}
  canvas{position:absolute;inset:0;width:100%;height:100%;z-index:2;display:block;touch-action:none;cursor:crosshair}
  .sticky{position:absolute;z-index:30;left:50%;top:50%;width:260px;height:260px;transform:translate(-50%,-50%) rotate(-1deg);
         background: linear-gradient(180deg,#fff59d 0%, #fff09a 60%);border-radius:6px;
         box-shadow:0 18px 30px rgba(2,6,23,0.12),0 6px 10px rgba(2,6,23,0.06);
         display:flex;align-items:center;justify-content:center;padding:16px;font-size:52px;font-weight:600;color:#0f1724;text-align:center;line-height:1}
  .right-top{position:absolute;right:16px;top:12px;z-index:40;display:flex;gap:10px;align-items:center}
  .btn{background:#fff;border:1px solid rgba(2,6,23,0.06);padding:8px 10px;border-radius:8px;cursor:pointer;box-shadow:0 6px 18px rgba(2,6,23,0.06)}
  .profile-initial{
    width:36px;height:36px;border-radius:18px;display:inline-flex;align-items:center;justify-content:center;
    font-weight:700;color:#fff;font-size:16px;
    background:linear-gradient(180deg,#f29a2e,#f97316); box-shadow:0 6px 12px rgba(2,6,23,0.08);
  }
  .zoom-control{position:absolute;right:18px;bottom:18px;z-index:40;background:#fff;border-radius:10px;padding:8px 10px;box-shadow:0 6px 18px rgba(2,6,23,0.06);display:flex;align-items:center;gap:8px}
  .zoom-control button{width:28px;height:28px;border-radius:6px;border:1px solid rgba(2,6,23,0.06);background:#fff;cursor:pointer}
  .cursor-dot{position:fixed;width:18px;height:18px;border-radius:9px;transform:translate(-50%,-50%);pointer-events:none;border:2px solid #fff;box-shadow:0 6px 12px rgba(2,6,23,0.12);z-index:60}
  @media (max-width:600px){ .sticky{width:200px;height:200px;font-size:40px} .leftbar{display:none} }
</style>
</head>
<body>
  <div class="thin-top" aria-hidden></div>

  <div class="topbar">
    <div class="brand-row">
      <div class="logo-text">Blanko</div>

      <div class="board-meta">
        <div class="meta-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7.5A1.5 1.5 0 014.5 6h4.172a1 1 0 01.707.293l1.328 1.328A1 1 0 0012.707 8H19.5A1.5 1.5 0 0121 9.5v8A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5v-10z" fill="#111827" /></svg>
        </div>

        <div class="board-name" title="${safeTitle}">${safeTitle}</div>

        <button class="dots-btn" aria-label="Board menu" title="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <circle cx="12" cy="6" r="1.9" fill="#111827"/>
            <circle cx="12" cy="12" r="1.9" fill="#111827"/>
            <circle cx="12" cy="18" r="1.9" fill="#111827"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="top-actions">
      <button id="shareBtn" class="btn">Share</button>
      <div class="profile-initial" id="profileInitial">${safeInitial}</div>
    </div>
  </div>

  <div class="wrap">
    <div class="leftbar" aria-hidden>
      <div class="tool" title="Magic">✦</div>
      <div class="tool" title="Select">▸</div>
      <div class="tool" title="Frames">▢</div>
      <div class="tool" title="Sticky">▭</div>
      <div class="tool" title="Text">T</div>
      <div class="tool" title="Pen">✎</div>
      <div class="tool" title="More">⋯</div>
    </div>

    <div class="canvas-area">
      <div class="grid" aria-hidden></div>
      <canvas id="boardCanvas"></canvas>

      <div class="sticky" role="article" aria-label="Sticky note">Hello<br/>World!</div>

      <div class="right-top"></div>

      <div class="zoom-control" aria-hidden><button id="zoomOut">−</button><div id="zoomLabel">100%</div><button id="zoomIn">+</button></div>
    </div>
  </div>

  <script src="${socketScriptUrl}"></script>
  <script>
    (function(){
      if (!window.createMockSocket) {
        console.warn("createMockSocket not available (mockSocketClient not loaded)");
        return;
      }
      const boardId = ${JSON.stringify(board.id)};
      const uid = 'u_' + Math.random().toString(36).slice(2,9);
      const uname = (window.dashData && window.dashData.name) || ('User ' + uid.slice(-3));
      const sock = createMockSocket(boardId, { id: uid, name: uname, color: '#3b82f6' });

      const canvas = document.getElementById('boardCanvas');
      const ctx = canvas.getContext('2d');

      function resize(){ const rect = canvas.parentElement.getBoundingClientRect(); const w=Math.floor(rect.width), h=Math.floor(rect.height); const tmp=document.createElement('canvas'); tmp.width=canvas.width; tmp.height=canvas.height; tmp.getContext('2d').drawImage(canvas,0,0); canvas.width=w; canvas.height=h; ctx.drawImage(tmp,0,0); }
      window.addEventListener('resize', resize); resize();
      ctx.lineCap='round'; ctx.lineJoin='round';

      function drawStroke(st){
        if(!st||!st.points) return;
        ctx.save();
        ctx.strokeStyle = st.color || '#111';
        ctx.lineWidth = st.size || 3;
        ctx.beginPath();
        st.points.forEach((p,i)=>{ const x = p.x * canvas.width, y = p.y * canvas.height; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
        ctx.stroke();
        ctx.restore();
      }

      // pointer handling
      let drawing=false, curStroke=null;
      function getPos(e){
        const r=canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x:(clientX - r.left)/r.width, y:(clientY - r.top)/r.height };
      }
      canvas.addEventListener('pointerdown',(e)=>{ drawing=true; curStroke={ color:'#111827', size:3, points:[getPos(e)] }; });
      canvas.addEventListener('pointermove',(e)=>{ const p=getPos(e); if(!drawing){ sock.send('cursor', p); return; } curStroke.points.push(p); drawStroke({ color:curStroke.color, size:curStroke.size, points:curStroke.points.slice(-2) }); });
      window.addEventListener('pointerup',()=>{ if(!drawing) return; drawing=false; sock.send('stroke', curStroke); curStroke=null; });

      // cursors
      const cursors = {};
      function showCursor(id,pos,color){
        if(!pos) return;
        let el = cursors[id];
        if(!el){
          el = document.createElement('div');
          el.className = 'cursor-dot';
          el.style.background = color || '#ef4444';
          document.body.appendChild(el);
          cursors[id] = el;
        }
        const rect = canvas.getBoundingClientRect();
        el.style.left = (rect.left + pos.x * rect.width) + 'px';
        el.style.top = (rect.top + pos.y * rect.height) + 'px';
      }
      function removeCursor(id){ const el=cursors[id]; if(el){ el.remove(); delete cursors[id]; } }

      sock.on('stroke', (msg) => {
        const payload = msg.payload || msg.stroke || msg;
        if (payload) drawStroke(payload);
      });
      sock.on('cursor', (msg) => {
        const payload = msg.payload || msg.pos || msg;
        const id = msg.userId || msg.sender || 'x';
        showCursor(id, payload, msg.color || '#ef4444');
      });
      sock.on('clear', () => ctx.clearRect(0,0,canvas.width,canvas.height));

      sock.send('join',{ id: uid, name: uname, color:'#3b82f6' });

      // bots demo
      setTimeout(()=> {
        const botColors = ['#f97316','#10b981','#f43f5e'];
        for (let bi=0; bi<3; bi++){
          (function(idx){
            setInterval(()=> {
              const pos={ x: Math.random()*0.8+0.1, y: Math.random()*0.8+0.1 };
              sock.send('cursor', pos);
            }, 900 + idx*120);
            setInterval(()=> {
              const start = { x: Math.random()*0.7+0.15, y: Math.random()*0.7+0.15 };
              const stroke = { color: botColors[idx%botColors.length], size: 2 + idx, points: [start] };
              for (let i=0;i<6;i++) stroke.points.push({ x: start.x + (Math.random()-0.5)*0.06, y: start.y + (Math.random()-0.5)*0.06 });
              sock.send('stroke', stroke);
            }, 1600 + idx*300);
          })(bi);
        }
      }, 900);

      // zoom (visual only)
      let zoom = 1;
      function setZoom(z){
        zoom = Math.max(0.4, Math.min(2, z));
        const label = document.getElementById('zoomLabel');
        if (label) label.textContent = Math.round(zoom*100) + '%';
        const area = document.querySelector('.canvas-area');
        if (area) {
          area.style.transformOrigin = '50% 50%';
          area.style.transform = 'scale(' + zoom + ')';
        }
      }
      const zi = document.getElementById('zoomIn');
      const zo = document.getElementById('zoomOut');
      if (zi) zi.addEventListener('click', ()=> setZoom(zoom + 0.1));
      if (zo) zo.addEventListener('click', ()=> setZoom(zoom - 0.1));
  </script>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
}

/* ---------- Main React component (Boards) ---------- */
export default function Boards({
                                   teams: teamsProp,
                                   activeTeamId,
                                   setActiveTeamId,
                                   createBoard: createBoardFromApp,
                                   moveBoard: moveBoardFromApp,
                                   renameBoard: renameBoardFromApp,
                                   deleteBoard: deleteBoardFromApp,
                               }) {
    // PROFILE + topbar state
    const [user, setUser] = useState({ name: "", email: "" });
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && window.dashData) {
            setUser({ name: window.dashData.name || "", email: window.dashData.email || "" });
        }
    }, []);

    const userInitial = user.name ? user.name[0].toUpperCase() : "?";

    // BOARDS state
    const [localBoards, setLocalBoards] = useState(initialBoards);
    const boardsSource = teamsProp ? [] : localBoards;

    const [view, setView] = useState("grid");
    const [menuBoardId, setMenuBoardId] = useState(null);
    const [starredIds, setStarredIds] = useState(() => new Set());

    const [toastMessage, setToastMessage] = useState("");
    const [toastVisible, setToastVisible] = useState(false);
    const toastTimeoutRef = useRef(null);

    // portal/menu refs
    const menuRef = useRef(null);
    const menuAnchorRef = useRef(null);
    const menuCardRef = useRef(null);
    const menuStyleRef = useRef(null);

    const [menuStyle, setMenuStyle] = useState(null);
    const [menuPlacement, setMenuPlacement] = useState("left");
    const [shiftMenuLeft, setShiftMenuLeft] = useState(false);

    // Notifications
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationsRef = useRef(null);
    const notificationsAnchorRef = useRef(null);

    // Dialogs
    const [dialog, setDialog] = useState(null);
    const [renameDraft, setRenameDraft] = useState("");

    // Helpers
    const showToast = (message) => {
        setToastMessage(message);
        setToastVisible(true);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setToastVisible(false), 1800);
    };

    const handleStarClick = (board) => {
        setStarredIds((prev) => {
            const next = new Set(prev);
            const willStar = !next.has(board.id);
            if (willStar) next.add(board.id); else next.delete(board.id);
            showToast(willStar ? "Board starred" : "Board unstarred");
            return next;
        });
    };

    // create board
    const handleCreateBoard = () => {
        if (createBoardFromApp) {
            const title = prompt("Название доски") || "Новая доска";
            createBoardFromApp(title);
            showToast("Доска создана");
            return;
        }
        setLocalBoards((prev) => {
            const colorKey = pickAvailableColorFrom(prev);
            const maxId = prev.reduce((m, b) => Math.max(m, b.id), 0);
            const id = maxId + 1;
            const newBoard = { id, title: "Новая доска", owner: user.name || "Owner", updated: "только что", lastOpened: "только что", onlineUsers: 0, colorKey };
            return [...prev, newBoard];
        });
        showToast("Доска создана");
    };

    // rename/delete dialogs
    const openRenameDialog = (board) => {
        setRenameDraft(board.title);
        setDialog({ type: "rename", boardId: board.id });
        closeMenu();
    };

    const openDeleteDialog = (board) => {
        setDialog({ type: "delete", boardId: board.id });
        closeMenu();
    };

    const closeDialog = () => { setDialog(null); setRenameDraft(""); };

    const handleRenameConfirm = () => {
        if (!dialog || dialog.type !== "rename") return;
        const value = renameDraft.trim();
        if (!value) { closeDialog(); return; }

        if (teamsProp) {
            if (typeof renameBoardFromApp === "function") {
                renameBoardFromApp(dialog.boardId, value);
                showToast("Доска переименована");
            } else {
                console.log("Rename requested for board id:", dialog.boardId, "new name:", value);
                showToast("Доска переименована (request logged)");
            }
        } else {
            setLocalBoards((prev) => prev.map((b) => (b.id === dialog.boardId ? { ...b, title: value } : b)));
            showToast("Доска переименована");
        }
        closeDialog();
    };

    const handleDeleteConfirm = () => {
        if (!dialog || dialog.type !== "delete") return;
        const id = dialog.boardId;

        if (teamsProp) {
            if (typeof deleteBoardFromApp === "function") {
                deleteBoardFromApp(id);
                showToast("Доска удалена");
            } else {
                console.log("Delete requested for board id:", id);
                showToast("Доска удалена (request logged)");
            }
        } else {
            setLocalBoards((prev) => prev.filter((b) => b.id !== id));
            setStarredIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            showToast("Доска удалена");
        }

        try {
            if (menuAnchorRef.current && Number(menuAnchorRef.current.dataset.boardId) === id) {
                menuAnchorRef.current = null;
            }
        } catch (err) {}
        closeMenu();
        closeDialog();
    };

    // centralize menu close logic so all codepaths behave same
    function closeMenu() {
        setMenuBoardId(null);
        menuCardRef.current = null;
        setMenuStyle(null);
        try {
            // ensure anchor blur so the overlay/focus state is removed visually
            if (menuAnchorRef.current && typeof menuAnchorRef.current.blur === "function") {
                try { menuAnchorRef.current.blur(); } catch {}
            }
        } catch (err) {}
        menuAnchorRef.current = null;
    }

    // menu toggle logic
    const handleMenuToggle = (id) => {
        setMenuBoardId((prev) => {
            const next = prev === id ? null : id;
            if (next === null) {
                setMenuPlacement("left");
                menuCardRef.current = null;
                setMenuStyle(null);
                if (menuAnchorRef.current && typeof menuAnchorRef.current.blur === "function") {
                    try { menuAnchorRef.current.blur(); } catch {}
                }
                menuAnchorRef.current = null;
            }
            return next;
        });
    };

    // compute menu placement & style
    useLayoutEffect(() => {
        if (!menuBoardId) { setMenuStyle(null); return; }
        let raf = 0;
        function update() {
            const anchor = menuAnchorRef.current;
            const menuEl = menuRef.current;
            const cardEl = document.querySelector(`[data-board-id="${menuBoardId}"]`);
            if (!anchor || !menuEl || !cardEl) {
                raf = requestAnimationFrame(update);
                return;
            }
            const anchorRect = anchor.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            const margin = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            let left = Math.round(anchorRect.left - menuRect.width - margin);
            let top = Math.round(anchorRect.top + (anchorRect.height / 2) - (menuRect.height / 2));
            let placement = "left";

            if (left < margin) {
                const rightLeft = Math.round(anchorRect.right + margin);
                if (rightLeft + menuRect.width <= vw - margin) {
                    left = rightLeft;
                    placement = "right";
                } else {
                    const topCandidate = Math.round(anchorRect.top - menuRect.height - margin);
                    const bottomCandidate = Math.round(anchorRect.bottom + margin);
                    if (topCandidate >= margin) {
                        top = topCandidate;
                        left = Math.round(anchorRect.left + (anchorRect.width / 2) - (menuRect.width / 2));
                        placement = "top";
                    } else {
                        top = bottomCandidate;
                        left = Math.round(anchorRect.left + (anchorRect.width / 2) - (menuRect.width / 2));
                        placement = "bottom";
                    }
                }
            }

            const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
            left = clamp(left, margin, Math.max(margin, vw - menuRect.width - margin));
            top = clamp(top, margin, Math.max(margin, vh - menuRect.height - margin));

            setMenuPlacement(placement);
            setMenuStyle({
                position: "fixed",
                left: `${left}px`,
                top: `${top}px`,
                zIndex: 2147483000,
            });
        }
        raf = requestAnimationFrame(update);
        function onResize() { requestAnimationFrame(update); }
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onResize, true);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onResize, true);
        };
    }, [menuBoardId]);

    // click outside & escape handling
    useEffect(() => {
        function isEventInside(event, element) {
            if (!event || !element) return false;
            if (event.composedPath) {
                const path = event.composedPath();
                return path.indexOf(element) !== -1;
            }
            if (event.path && event.path.length) {
                return event.path.indexOf(element) !== -1;
            }
            return element.contains ? element.contains(event.target) : false;
        }

        function handleClickOutside(e) {
            if (menuBoardId) {
                const menuEl = menuRef.current;
                const anchorEl = menuAnchorRef.current;
                const insideMenu = isEventInside(e, menuEl);
                const onAnchor = isEventInside(e, anchorEl);
                if (!insideMenu && !onAnchor) {
                    closeMenu();
                }
            }
            if (isNotificationsOpen) {
                const notifEl = notificationsRef.current;
                const notifAnchorEl = notificationsAnchorRef.current;
                const insideNotif = isEventInside(e, notifEl);
                const onNotifAnchor = isEventInside(e, notifAnchorEl);
                if (!insideNotif && !onNotifAnchor) {
                    setIsNotificationsOpen(false);
                }
            }
        }

        function handleKeydown(e) {
            if (e.key === "Escape") {
                closeMenu();
                setIsNotificationsOpen(false);
            }
        }

        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleKeydown);
        return () => {
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("keydown", handleKeydown);
        };
    }, [menuBoardId, isNotificationsOpen]);

    // board list/array to render — chosen by activeTeamId if teamsProp given
    const renderContext = useMemo(() => {
        if (teamsProp) {
            // When teamsProp is provided, show boards only for a selected team.
            // If no activeTeamId is set (user has no teams), do not fall back to localBoards.
            const team = activeTeamId ? teamsProp.find((t) => t.id === activeTeamId) : null;
            return { team: team || null, boards: team ? assignColorsToInitial(team.boards || []) : [] };
        }
        // legacy fallback when app is not team-enabled: use localBoards
        return { team: null, boards: assignColorsToInitial(localBoards) };
    }, [teamsProp, activeTeamId, localBoards]);

    // Determine whether user is allowed to create boards:
    const canCreateBoard = teamsProp ? Boolean(activeTeamId) : true;

    // Determine whether the user actually has teams (used to show global placeholder)
    const userHasTeams = Array.isArray(teamsProp) ? teamsProp.length > 0 : true;

    // Determine whether the selected team (if any) has boards
    const selectedTeamHasBoards = Boolean(renderContext.team && (renderContext.boards || []).length > 0);

    // UI render
    return (
        <div className="boards-page">
            {/* TOP BAR */}
            <header className="topbar">
                <div className="topbar-left">
                    <div className="topbar-logo-wrap">
                        <span className="topbar-logo">Blanko</span>
                        <span className="topbar-badge">Free</span>
                    </div>
                </div>

                <div className="topbar-center" aria-hidden />

                <div className="topbar-right">
                    <NotificationButton
                        unreadCount={unreadCount}
                        onClick={(e) => {
                            notificationsAnchorRef.current = e.currentTarget;
                            setIsNotificationsOpen((v) => !v);
                        }}
                    />

                    <ProfileButton userInitial={userInitial} onClick={() => setIsProfileMenuOpen((prev) => !prev)} />

                    {isProfileMenuOpen && (
                        <ProfileMenu
                            name={user.name || "User"}
                            email={user.email || "user@example.com"}
                            onSettings={() => {
                                setIsProfileMenuOpen(false);
                                setIsProfileModalOpen(true);
                            }}
                            onLogout={() => console.log("Logout clicked")}
                            onClose={() => setIsProfileMenuOpen(false)}
                        />
                    )}
                </div>
            </header>

            <NotificationsPanel ref={notificationsRef} isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />

            <div className="topbar-divider" />

            {/* TEMPLATE ISLAND */}
            <TemplatesIsland />

            <div className="templates-bottom-divider" />

            <div className="boards-wrapper">
                <div className="boards-header-line">
                    <button
                        type="button"
                        className={`primary-btn create-btn ${!canCreateBoard ? "disabled" : ""}`}
                        onClick={() => {
                            if (!canCreateBoard) return;
                            (createBoardFromApp ? createBoardFromApp() : handleCreateBoard());
                        }}
                        disabled={!canCreateBoard}
                        aria-disabled={!canCreateBoard}
                        title={!canCreateBoard ? "Нельзя создавать доски без выбранной команды" : "Создать доску"}
                    >
                        + Создать доску
                    </button>
                </div>

                {/* If user has no teams (team-enabled app), show minimal centered hint instead of filters + boards */}
                {!userHasTeams ? (
                    <div className="boards-empty-hint" role="status" aria-live="polite">
                        <p className="boards-empty-hint__text">Чтобы создавать доски, создайте команду или присоединитесь к существующей.</p>
                    </div>
                ) : (
                    // If the user has teams but selected team has no boards -> show team-empty hint
                    !selectedTeamHasBoards ? (
                        <div className="boards-team-empty-hint" role="status" aria-live="polite">
                            <p className="boards-team-empty-hint__text">В этой команде пока нет досок. Создайте первую доску, чтобы начать работу вместе.</p>
                        </div>
                    ) : (
                        <>
                            <div className="boards-toolbar">
                                <div className="boards-filters">
                                    <div className="filter-group"><span className="filter-label">Filter by</span><select className="filter-select" defaultValue="all"><option value="all">All boards</option></select></div>
                                    <div className="filter-group"><span className="filter-label">Owned by</span><select className="filter-select" defaultValue="anyone"><option value="anyone">Owned by anyone</option><option value="me">Owned by me</option></select></div>
                                    <div className="filter-group"><span className="filter-label">Sort by</span><select className="filter-select" defaultValue="last-opened"><option value="last-opened">Last opened</option><option value="name">Name</option><option value="updated">Last modified</option></select></div>
                                </div>

                                <div className="boards-view-toggle"><ViewToggle view={view} setView={setView} /></div>
                            </div>

                            {view === "grid" ? (
                                <div className="boards-grid">
                                    {renderContext.boards.map((b, index) => {
                                        const isStarred = starredIds.has(b.id);
                                        const isMenuOpen = menuBoardId === b.id;
                                        const colorKey = b.colorKey ?? colorKeys[index % colorKeys.length];
                                        return (
                                            <div
                                                key={b.id}
                                                className={`board-card ${isMenuOpen ? "board-card--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`}
                                                data-board-id={b.id}
                                                ref={(el) => { if (isMenuOpen) menuCardRef.current = el; }}
                                                onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }} // close menu as cursor leaves card
                                                onClick={() => openBoardWindow(b)}
                                            >
                                                <div className={`board-header board-header--${colorKey}`}>
                                                    <div className="board-preview" />
                                                    <div className="board-card-controls" aria-hidden onClick={(e) => e.stopPropagation()}>
                                                        <div className="board-menu-wrapper">
                                                            <MenuButton
                                                                variant="grid"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    try { e.currentTarget.dataset.boardId = String(b.id); } catch (err) {}
                                                                    menuAnchorRef.current = e.currentTarget;
                                                                    setMenuPlacement("left");
                                                                    setShiftMenuLeft(false);
                                                                    handleMenuToggle(b.id);
                                                                }}
                                                            />
                                                            {menuBoardId === b.id && (
                                                                <MenuPortal isOpen={true} anchorRef={menuAnchorRef} placement={menuPlacement} shiftLeft={shiftMenuLeft} onClose={closeMenu}>
                                                                    <div ref={menuRef} className="board-card-menu" style={menuStyle || {}} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                                        <button type="button" className="board-card-menu-item" onClick={() => { console.log("Share", b.id); }}><span className="board-card-menu-icon">↗︎</span><span className="board-card-menu-label">Поделиться</span></button>
                                                                        <button type="button" className="board-card-menu-item" onClick={() => { console.log("Copy link", b.id); }}><span className="board-card-menu-icon">🔗</span><span className="board-card-menu-label">Скопировать ссылку</span></button>
                                                                        <button type="button" className="board-card-menu-item" onClick={() => { console.log("Open in new tab", b.id); }}><span className="board-card-menu-icon">⧉</span><span className="board-card-menu-label">Открыть в новой вкладке</span></button>
                                                                        <div className="board-card-menu-separator" />
                                                                        <button type="button" className="board-card-menu-item" onClick={() => console.log("Info", b.id)}><span className="board-card-menu-icon">ⓘ</span><span className="board-card-menu-label">Инфо</span></button>
                                                                        <button type="button" className="board-card-menu-item" onClick={() => openRenameDialog(b)}><span className="board-card-menu-icon">✎</span><span className="board-card-menu-label">Переименовать</span></button>
                                                                        <div className="board-card-menu-separator" />
                                                                        <button type="button" className="board-card-menu-item board-card-menu-item--danger" onClick={() => openDeleteDialog(b)}><span className="board-card-menu-icon">🗑</span><span className="board-card-menu-label">Удалить</span></button>
                                                                    </div>
                                                                </MenuPortal>
                                                            )}
                                                        </div>

                                                        <div className={`board-star-wrapper ${isStarred ? "board-star-wrapper--active" : ""}`} onClick={(e) => e.stopPropagation()}>
                                                            <StarButton isStarred={isStarred} onToggle={() => handleStarClick(b)} variant="grid" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="board-info">
                                                    <div className="board-title">{b.title}</div>
                                                    <div className="line"><span className="label">Owner:</span> {b.owner}</div>
                                                    <div className="line"><span className="label">Last opened:</span> {b.lastOpened}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="boards-list">
                                    <div className="boards-list-header" role="row">
                                        <div>Name</div>
                                        <div style={{ textAlign: "center" }}>Online users</div>
                                        <div style={{ textAlign: "center" }}>Last opened</div>
                                        <div style={{ textAlign: "left" }}>Owner</div>
                                        <div style={{ textAlign: "right" }} aria-hidden> </div>
                                    </div>

                                    {renderContext.boards.map((b, index) => {
                                        const isStarred = starredIds.has(b.id);
                                        const isMenuOpen = menuBoardId === b.id;
                                        const isLastRow = index === renderContext.boards.length - 1;
                                        const colorKey = b.colorKey ?? colorKeys[index % colorKeys.length];
                                        return (
                                            <div
                                                key={b.id}
                                                data-board-id={b.id}
                                                className={`boards-list-row ${isMenuOpen ? "boards-list-row--menu-open" : ""} ${isStarred ? "board-card--starred" : ""}`}
                                                onMouseLeave={() => { if (menuBoardId === b.id) closeMenu(); }}
                                            >
                                                <div className="boards-name-cell" onClick={() => openBoardWindow(b)}>
                                                    <div className={`board-image-small board-image-small--${colorKey}`} aria-hidden />
                                                    <div className="boards-name-text">
                                                        <div className="board-row-title">{b.title}</div>
                                                        <div className="board-row-sub">Modified by {b.owner}, {b.updated}</div>
                                                    </div>
                                                </div>

                                                <div className="boards-col" style={{ textAlign: "center" }}>{b.onlineUsers > 0 ? `${b.onlineUsers} online` : "—"}</div>

                                                <div className="boards-col" style={{ textAlign: "center" }}>{b.lastOpened}</div>

                                                <div className="boards-col owner" style={{ textAlign: "left" }}>{b.owner}</div>

                                                <div className="boards-actions-cell" onClick={(e) => e.stopPropagation()}>
                                                    <div onClick={(e) => { e.stopPropagation(); }}>
                                                        <StarButton isStarred={isStarred} onToggle={() => handleStarClick(b)} variant="list" />
                                                    </div>

                                                    <div style={{ position: "relative" }} className="board-menu-wrapper" onClick={(e) => e.stopPropagation()}>
                                                        <MenuButton
                                                            variant="list"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                try { e.currentTarget.dataset.boardId = String(b.id); } catch (err) {}
                                                                menuAnchorRef.current = e.currentTarget;
                                                                const forceTop = isLastRow;
                                                                setMenuPlacement(forceTop ? "top" : "left");
                                                                handleMenuToggle(b.id);
                                                            }}
                                                        />

                                                        {menuBoardId === b.id && (
                                                            <MenuPortal isOpen={true} anchorRef={menuAnchorRef} placement={menuPlacement} shiftLeft={shiftMenuLeft} onClose={closeMenu}>
                                                                <div ref={menuRef} className="board-card-menu board-card-menu--list" style={menuStyle || {}} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                                    <button type="button" className="board-card-menu-item" onClick={() => console.log("Share", b.id)}><span className="board-card-menu-icon">↗︎</span><span className="board-card-menu-label">Поделиться</span></button>
                                                                    <button type="button" className="board-card-menu-item" onClick={() => console.log("Copy link", b.id)}><span className="board-card-menu-icon">🔗</span><span className="board-card-menu-label">Скопировать ссылку</span></button>
                                                                    <button type="button" className="board-card-menu-item" onClick={() => console.log("Open in new tab", b.id)}><span className="board-card-menu-icon">⧉</span><span className="board-card-menu-label">Открыть в новой вкладке</span></button>
                                                                    <div className="board-card-menu-separator" />
                                                                    <button type="button" className="board-card-menu-item" onClick={() => console.log("Info", b.id)}><span className="board-card-menu-icon">ⓘ</span><span className="board-card-menu-label">Инфо</span></button>
                                                                    <button type="button" className="board-card-menu-item" onClick={() => openRenameDialog(b)}><span className="board-card-menu-icon">✎</span><span className="board-card-menu-label">Переименовать</span></button>
                                                                    <div className="board-card-menu-separator" />
                                                                    <button type="button" className="board-card-menu-item board-card-menu-item--danger" onClick={() => openDeleteDialog(b)}><span className="board-card-menu-icon">🗑</span><span className="board-card-menu-label">Удалить</span></button>
                                                                </div>
                                                            </MenuPortal>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )
                )}
                {toastVisible && <div className="boards-toast">{toastMessage}</div>}
            </div>

            {/* Rename/Delete modals */}
            {dialog && dialog.type === "rename" && (
                <div
                    className="boards-modal-backdrop"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
                >
                    <div className="boards-modal" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="boards-modal-header">
                            <h3 className="boards-modal-title">Переименовать доску</h3>
                            <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={closeDialog}>×</button>
                        </div>
                        <div className="boards-modal-body">
                            <input
                                className={`boards-modal-input ${renameDraft.trim() === "" ? "boards-modal-input--empty" : ""}`}
                                value={renameDraft}
                                autoFocus
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleRenameConfirm(); if (e.key === "Escape") closeDialog(); }}
                                aria-label="Новое имя доски"
                                aria-invalid={renameDraft.trim() === ""}
                                placeholder="Название доски"
                            />
                        </div>
                        <div className="boards-modal-footer">
                            <button
                                type="button"
                                className="primary-btn"
                                onClick={handleRenameConfirm}
                                disabled={renameDraft.trim() === ""}
                                aria-disabled={renameDraft.trim() === ""}
                            >
                                Сохранить
                            </button>
                            <button type="button" className="secondary-btn" onClick={closeDialog}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {dialog && dialog.type === "delete" && (
                <div
                    className="boards-modal-backdrop"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
                >
                    <div className="boards-modal" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="boards-modal-header">
                            <h3 className="boards-modal-title">Удалить доску?</h3>
                            <button type="button" className="boards-modal-close" aria-label="Закрыть" onClick={closeDialog}>×</button>
                        </div>
                        <div className="boards-modal-body">
                            <p>Это приведет к удалению <strong>{(teamsProp ? renderContext.boards : localBoards).find((x) => x.id === dialog.boardId)?.title}</strong>.</p>
                        </div>
                        <div className="boards-modal-footer">
                            <button type="button" className="danger-btn" onClick={handleDeleteConfirm}>Удалить</button>
                            <button type="button" className="secondary-btn" onClick={closeDialog}>Отмена</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile modal */}
            {isProfileModalOpen && (
                <ProfileModal
                    name={user.name}
                    email={user.email}
                    teams={teamsProp || []}
                    activeTeamId={activeTeamId}
                    onOpenTeam={(teamId) => {
                        if (typeof setActiveTeamId === "function") setActiveTeamId(teamId);
                        setIsProfileModalOpen(false);
                    }}
                    onClose={() => setIsProfileModalOpen(false)}
                    onSave={(newName) => {
                        setUser((p) => ({ ...p, name: newName }));
                        setIsProfileModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}