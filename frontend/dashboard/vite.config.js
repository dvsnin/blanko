import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],

    // Vite root - индекс и ресурсы лежат в frontend/dashboard/src
    root: path.resolve(__dirname, "src"),

    server: {
        port: 5173
    },

    build: {
        // production сборка попадёт в папку, откуда backend отдаёт статику
        outDir: path.resolve(__dirname, "../../backend/app/static/dashboard"),
        emptyOutDir: true
    },

    base: '/app/',

    test: {
        environment: 'jsdom',
        // vitest stubs css to '' by default, including ?raw; the palette test needs the real text
        css: { include: [/BoardCover\.css/, /Boards\.css/, /Boards\.list\.css/, /TemplateCard\.css/, /GroupsPage\.css/, /StarButton\.css/] },
        include: ['**/*.test.{ts,tsx}']
    },
});