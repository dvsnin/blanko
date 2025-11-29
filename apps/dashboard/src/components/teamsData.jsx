// teamsData.jsx
// Minimal initial teams dataset (roles only). Role values must be one of: "owner", "admin", "member".
// If a team lacks a valid role, it's considered invalid and will be ignored by the app initialization.

const initialTeams = [
    {
        id: "team-marketing",
        name: "Маркетинг",
        role: "owner",   // вы — owner в тестовых данных
        boards: [
            { id: 2, title: "Маркетинг 2025", owner: "Дмитрий Васянин", lastOpened: "12 ноября", colorKey: "peach" },
            { id: 3, title: "Roadmap SyncBoard", owner: "Дмитрий Васянин", lastOpened: "10 ноября", colorKey: "lilac" },
        ],
    },
    {
        id: "team-growth",
        name: "Growth",
        role: "member",  // вы — member
        boards: [
            { id: 1, title: "МояПикерДоска", owner: "Дмитрий Васянин", lastOpened: "14 ноября", colorKey: "mintBlue" },
            { id: 4, title: "Учебный проект", owner: "Дмитрий Васянин", lastOpened: "8 ноября", colorKey: "aqua" },
        ],
    },
    {
        id: "team-product",
        name: "Product",
        role: "admin",   // вы — admin
        boards: [
            { id: 5, title: "Личное планирование", owner: "Дмитрий Васянин", lastOpened: "7 ноября", colorKey: "sunset" },
            { id: 6, title: "Личное", owner: "Дмитрий Васянин", lastOpened: "12 декабря", colorKey: "grass" },
            { id: 7, title: "Финансы", owner: "Дмитрий Васянин", lastOpened: "13 декабря", colorKey: "ocean" },
        ],
    },
];

export default initialTeams;