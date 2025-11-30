import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],

    // Vite root — индекс и ресурсы лежат в apps/canvas/src
    root: path.resolve(__dirname, "src"),

    server: {
        port: 5174,
        proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } }
    },

    build: {
        // production сборка попадёт в папку, откуда backend отдаёт статику
        outDir: path.resolve(__dirname, "../../backend/app/static/canvas"),
        emptyOutDir: true,
        assetsDir: "assets",
        // генерировать manifest не обязательно, т.к. мы используем index.html как entry (как для dashboard)
        // manifest: true,
        rollupOptions: {
            // оставляем index.html в качестве html entry; можно явно указать input, но не обязательно
            input: path.resolve(__dirname, "src/index.html")
        }
    },

    resolve: {
        alias: {
            "@blanko/ui": path.resolve(__dirname, "../../packages/ui/src")
        }
    },

    // чтобы ссылки в index.html были вида /app/assets/..., как у dashboard
    base: '/app/',
});