import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],

    // Vite root — индекс и ресурсы лежат в frontend/dashboard/src
    root: path.resolve(__dirname, "src"),

    server: {
        port: 5173
    },

    build: {
        // production сборка попадёт в папку, откуда backend отдаёт статику
        outDir: path.resolve(__dirname, "../../backend/app/static/dashboard"),
        emptyOutDir: true
    },

    resolve: {
        alias: {
            "@blanko/ui": path.resolve(__dirname, "../../packages/ui/src")
        }
    },

    base: '/app/',
});