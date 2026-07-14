import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4: o plugin do Vite dispensa tailwind.config e postcss.config.
// base: serve este app na subpasta /projects/churn-radar/ dentro do portfólio.
export default defineConfig({
  base: "/projects/churn-radar/",
  plugins: [react(), tailwindcss()],
});
