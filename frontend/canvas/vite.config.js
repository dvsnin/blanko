import { defineConfig } from "vite";
import path from "path";

// Канвас: один JS-модуль, один CSS и ресурсы tldraw (шрифты, иконки, переводы) без хешей в именах
// входа, чтобы backend/app/static/canvas/index.html ссылался на них статически.
export default defineConfig({
    root: path.resolve(__dirname, "src"),
    base: "/app/static/canvas/assets/",
    build: {
        outDir: path.resolve(__dirname, "../../backend/app/static/canvas/assets"),
        emptyOutDir: true,
        rollupOptions: {
            input: path.resolve(__dirname, "src/main.js"),
            output: {
                entryFileNames: "canvas.js",
                chunkFileNames: "[name]-[hash].js",
                assetFileNames: (info) => (info.name && info.name.endsWith(".css") ? "canvas.css" : "[name]-[hash][extname]"),
            },
        },
    },
});
