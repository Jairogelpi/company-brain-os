import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "scripts"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs"]);
const violations = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "coverage") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;

    const text = await readFile(full, "utf8");
    const checks = [
      [/@ts-ignore\b/g, "@ts-ignore is forbidden; fix or narrow the type instead"],
      [/@ts-nocheck\b/g, "@ts-nocheck is forbidden"],
      [/\bdebugger\s*;/g, "debugger statements are forbidden"],
      [/\b(?:TODO|FIXME|HACK)\b/g, "unresolved TODO/FIXME/HACK marker in executable code"],
    ];

    for (const [pattern, message] of checks) {
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split("\n").length;
        violations.push(`${full}:${line} ${message}`);
      }
    }
  }
}

for (const root of roots) await walk(root);

if (violations.length) {
  console.error("Repository lint failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Repository lint passed: no suppression markers, debugger statements, or unresolved code TODOs.");
