// teamsData.jsx
// Minimal initial teams dataset (JSX extension OK for consistency).
// No logic here — only data. Edit later or replace with API.

const initialTeams = [
    {
        id: "team-marketing",
        name: "Маркетинг",
        isOwner: true,
        role: "admin",
        boards: [
            { id: 2, title: "Маркетинг 2025", owner: "Дмитрий Васянин", lastOpened: "12 ноября", colorKey: "peach" },
            { id: 3, title: "Roadmap SyncBoard", owner: "Дмитрий Васянин", lastOpened: "10 ноября", colorKey: "lilac" },
        ],
    },
    {
        id: "team-growth",
        name: "Growth",
        isOwner: false,
        role: "member",
        boards: [
            { id: 1, title: "МояПикерДоска", owner: "Дмитрий Васянин", lastOpened: "14 ноября", colorKey: "mintBlue" },
            { id: 4, title: "Учебный проект", owner: "Дмитрий Васянин", lastOpened: "8 ноября", colorKey: "aqua" },
        ],
    },
    {
        id: "team-product",
        name: "Product",
        isOwner: true,
        role: "admin",
        boards: [
            { id: 5, title: "Личное планирование", owner: "Дмитрий Васянин", lastOpened: "7 ноября", colorKey: "sunset" },
            { id: 6, title: "Личное", owner: "Дмитрий Васянин", lastOpened: "12 декабря", colorKey: "grass" },
            { id: 7, title: "Финансы", owner: "Дмитрий Васянин", lastOpened: "13 декабря", colorKey: "ocean" },
        ],
    },
];

export default initialTeams;