import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/company_brain_os";
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  SEED_PASSWORD: process.env.SEED_PASSWORD ?? "local-verification-password",
};

const gates = [
  ["Production migrations", "npm run db:migrate"],
  ["Explicit local/test seed", "npm run db:seed"],
  ["Full test suite", "npm test -- --run"],
  ["Canonical Pedro / Laura E2E", "npm run test:e2e"],
  ["Critical domain coverage", "npm run test:critical"],
  ["PostgreSQL tenant isolation", "npx vitest --config test.integration.config.ts run"],
  ["TypeScript", "npm run typecheck"],
  ["Production build", "npm run build", { AUTH_SECRET: process.env.AUTH_SECRET ?? "local-verification-build-secret" }],
  ["Production dependency audit", "npm audit --omit=dev --audit-level=high"],
];

console.log("\nCompany Brain OS — local repository verification");
console.log(`Database: ${databaseUrl.replace(/:[^:@/]+@/, ":***@")}`);
console.log("Prerequisite: run `npm ci` before this command.\n");

for (const [name, command, extraEnv = {}] of gates) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(command, {
    cwd: process.cwd(),
    env: { ...env, ...extraEnv },
    shell: true,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`\nFAIL: ${name}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nFAIL: ${name} (exit ${result.status ?? "unknown"})`);
    process.exit(result.status ?? 1);
  }

  console.log(`PASS: ${name}`);
}

console.log("\n========================================");
console.log("REPOSITORY GATE: PASS");
console.log("All repository-controlled local gates passed.");
console.log("External customer, legal, restore-drill and independent security evidence remain separate validation gates.");
console.log("========================================\n");
