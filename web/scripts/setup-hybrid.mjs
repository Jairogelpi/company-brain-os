import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;
const PRIMARY_CONTAINER = "company-brain-postgres";
const FALLBACK_CONTAINER = "company-brain-postgres-safe";
const DB_NAME = "company_brain_os";
const DB_USER = "postgres";
const DB_PASSWORD = "postgres";
const PORT_START = 55432;
const PORT_END = 55532;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.${detail}`);
  }
  return result;
}

function docker(args, options = {}) {
  return run("docker", args, options);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function chooseFreePort() {
  for (let port = PORT_START; port <= PORT_END; port += 1) {
    if (await portIsFree(port)) return port;
  }
  throw new Error(`No free TCP port found in ${PORT_START}-${PORT_END}.`);
}

function containerExists(name) {
  return docker(["inspect", name], { capture: true, allowFailure: true }).status === 0;
}

function containerRunning(name) {
  const result = docker(["inspect", "-f", "{{.State.Running}}", name], {
    capture: true,
    allowFailure: true,
  });
  return result.status === 0 && result.stdout.trim() === "true";
}

function mappedHostPort(name) {
  const result = docker(["port", name, "5432/tcp"], { capture: true, allowFailure: true });
  if (result.status !== 0) return null;
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/:(\d+)\s*$/);
    if (match) return Number(match[1]);
  }
  return null;
}

function waitForPostgres(name) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = docker(
      ["exec", name, "pg_isready", "-U", DB_USER, "-d", DB_NAME],
      { capture: true, allowFailure: true },
    );
    if (result.status === 0) return;
    sleep(500);
  }
  throw new Error(`PostgreSQL in ${name} did not become ready.`);
}

function createContainer(name, port) {
  console.log(`Creating PostgreSQL 16 + pgvector container ${name} on host port ${port}...`);
  docker([
    "run", "--name", name,
    "-e", `POSTGRES_USER=${DB_USER}`,
    "-e", `POSTGRES_PASSWORD=${DB_PASSWORD}`,
    "-e", `POSTGRES_DB=${DB_NAME}`,
    "-p", `${port}:5432`,
    "-d", "pgvector/pgvector:pg16",
  ]);
  waitForPostgres(name);
}

async function inspectDatabase(url) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    const version = await client.query(`
      SELECT
        current_database() AS db,
        current_setting('server_version_num')::int AS version_num,
        version() AS version,
        inet_server_addr()::text AS host,
        inet_server_port() AS port
    `);
    const vector = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
      ) AS available
    `);
    return { ...version.rows[0], vectorAvailable: vector.rows[0]?.available === true };
  } finally {
    await client.end().catch(() => {});
  }
}

function upsertEnv(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.trimEnd()}\n${line}\n`;
}

function ensureLocalEnv(databaseUrl) {
  const path = ".env.local";
  let text = existsSync(path) ? readFileSync(path, "utf8") : "";
  text = upsertEnv(text, "DATABASE_URL", databaseUrl);

  const authMatch = text.match(/^AUTH_SECRET=(.*)$/m);
  const authValue = authMatch?.[1]?.trim();
  if (!authValue || authValue.includes("<") || authValue.length < 32) {
    text = upsertEnv(text, "AUTH_SECRET", randomBytes(32).toString("hex"));
  }
  text = upsertEnv(text, "AUTH_TRUST_HOST", "true");
  text = upsertEnv(text, "STORAGE_DRIVER", "disk");
  text = upsertEnv(text, "STORAGE_DIR", "./uploads");
  text = upsertEnv(text, "MALWARE_SCAN_MODE", "basic");
  writeFileSync(path, text, "utf8");
}

async function ensureUsableContainer() {
  // Prefer the canonical container if it already uses a non-conflicting host port.
  if (containerExists(PRIMARY_CONTAINER)) {
    if (!containerRunning(PRIMARY_CONTAINER)) docker(["start", PRIMARY_CONTAINER]);
    waitForPostgres(PRIMARY_CONTAINER);
    const port = mappedHostPort(PRIMARY_CONTAINER);
    if (port && port !== 5432) return { name: PRIMARY_CONTAINER, port };

    // Port 5432 is intentionally not trusted on developer machines: a native
    // PostgreSQL service can win the localhost binding (especially on Windows).
    console.log(
      `${PRIMARY_CONTAINER} is mapped to host port 5432. Leaving it untouched and using an isolated safe container instead.`,
    );
  }

  if (containerExists(FALLBACK_CONTAINER)) {
    if (!containerRunning(FALLBACK_CONTAINER)) docker(["start", FALLBACK_CONTAINER]);
    waitForPostgres(FALLBACK_CONTAINER);
    const port = mappedHostPort(FALLBACK_CONTAINER);
    if (port) return { name: FALLBACK_CONTAINER, port };
    throw new Error(`${FALLBACK_CONTAINER} exists but does not publish PostgreSQL port 5432.`);
  }

  const port = await chooseFreePort();
  const name = containerExists(PRIMARY_CONTAINER) ? FALLBACK_CONTAINER : PRIMARY_CONTAINER;
  createContainer(name, port);
  return { name, port };
}

async function main() {
  console.log("Company Brain OS — deterministic hybrid setup");
  console.log("Checking Docker...");
  docker(["version"], { capture: true });

  const { name, port } = await ensureUsableContainer();
  const databaseUrl = `postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${port}/${DB_NAME}`;

  const info = await inspectDatabase(databaseUrl);
  const major = Math.floor(Number(info.version_num) / 10000);
  if (major !== 16) {
    throw new Error(`Expected PostgreSQL 16, but ${databaseUrl} reached: ${info.version}`);
  }
  if (!info.vectorAvailable) {
    throw new Error(`pgvector is not available in ${name}. Expected image pgvector/pgvector:pg16.`);
  }

  console.log(`Verified ${info.version}`);
  console.log(`Verified Docker database endpoint: 127.0.0.1:${port}/${DB_NAME}`);

  ensureLocalEnv(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;

  console.log("Running production migrations against the verified database...");
  run("npm", ["run", "db:migrate"], { env: { DATABASE_URL: databaseUrl } });

  const after = await inspectDatabase(databaseUrl);
  console.log(`Database ready: ${after.db} on PostgreSQL 16 with pgvector available.`);
  console.log("Updated web/.env.local to use the same verified database endpoint.");
  console.log("");
  console.log("Setup complete. Do NOT run db:seed for a real zero-state onboarding test.");
  console.log("Next: npm run dev");
  console.log("Then open the URL printed by Next.js and visit /register.");
}

main().catch((error) => {
  console.error("\nSETUP FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  console.error("No existing database/container was deleted by this installer.");
  process.exit(1);
});
