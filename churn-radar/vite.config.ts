import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4: o plugin do Vite dispensa tailwind.config e postcss.config.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
