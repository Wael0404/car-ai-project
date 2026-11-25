/**
 * Second copy of everything the agents produced (the "double sauvegarde"):
 *   - a full PostgreSQL dump (VIN profiles, maintenance plans, 3D/photo
 *     choices, prices, users' cars),
 *   - the photos and 3D files served from apps/api/models.
 * Usage: npm run db:backup   (writes apps/api/backups/<date>/)
 * In production, schedule it daily and copy the folder off the server.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = join(apiDir, "backups", stamp);
mkdirSync(out, { recursive: true });

// pg_dump runs inside the docker-compose PostgreSQL container.
const dump = execFileSync(
  "docker",
  ["compose", "exec", "-T", "postgres", "pg_dump", "-U", "carai", "-d", "carai", "--format=plain", "--no-owner"],
  { cwd: join(apiDir, "..", ".."), maxBuffer: 1024 * 1024 * 1024 },
);
writeFileSync(join(out, "carai.sql"), dump);

const models = join(apiDir, "models");
if (existsSync(models)) cpSync(models, join(out, "models"), { recursive: true });

console.log(`Backup written to ${out} (${(dump.length / 1024).toFixed(0)} KB of SQL)`);
