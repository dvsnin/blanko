import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    root: "./",
    build: {
        outDir: "../backend/app/static/dashboard",
        emptyOutDir: true
    }
});
