// Builda o portfólio + os 3 mini-apps React/Vite e junta tudo em dist/,
// pronto pra servir como um único deploy estático no Vercel.
//
//   dist/                    <- portfólio estático (index.html, styles.css, script.js)
//   dist/projects/chronos/          <- build do app Chronos
//   dist/projects/churn-radar/      <- build do app Churn Radar
//   dist/projects/logistica-smart/  <- build do app Logística Smart

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "dist");

function run(cmd, cwd) {
  console.log(`\n> (${path.relative(root, cwd) || "."}) ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// 1. limpa dist/
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 2. copia o portfólio estático (não precisa de build, é HTML/CSS/JS puro)
for (const file of ["index.html", "styles.css", "script.js"]) {
  fs.cpSync(path.join(root, file), path.join(outDir, file));
}

// 3. builda cada mini-app e copia o resultado para dist/projects/<nome>
const projects = ["chronos", "churn-radar", "logistica-smart"];
const projectsDir = path.join(root, "projects");
const outProjectsDir = path.join(outDir, "projects");
fs.mkdirSync(outProjectsDir, { recursive: true });

for (const name of projects) {
  const projDir = path.join(projectsDir, name);
  run("npm install", projDir);
  run("npm run build", projDir);

  const projDist = path.join(projDir, "dist");
  const dest = path.join(outProjectsDir, name);
  fs.cpSync(projDist, dest, { recursive: true });
}

console.log("\nBuild completo. Saída em dist/");
