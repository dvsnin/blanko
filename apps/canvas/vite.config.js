import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    root: path.resolve(__dirname, "src"),
    server: { port: 5174, proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } } },
    build: {
        outDir: path.resolve(__dirname, "../../backend/app/static/canvas"),
        emptyOutDir: true
    }
});