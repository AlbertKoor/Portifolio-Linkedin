import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4: o plugin do Vite dispensa tailwind.config e postcss.config.
// base: serve este app na subpasta /projects/logistica-smart/ dentro do portfólio.
export default defineConfig({
  base: "/projects/logistica-smart/",
  plugins: [react(), tailwindcss()],
});
