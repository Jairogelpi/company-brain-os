import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "scripts"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".css", ".md"]);
const violations = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "coverage"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;

    const text = await readFile(full, "utf8");
    if (text.includes("\r\n")) violations.push(`${full}: CRLF line endings are not allowed`);
    if (text.length > 0 && !text.endsWith("\n")) violations.push(`${full}: missing final newline`);

    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (/[ \t]+$/.test(line)) violations.push(`${full}:${index + 1} trailing whitespace`);
    });
  }
}

for (const root of roots) await walk(root);

if (violations.length) {
  console.error("Format check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Format check passed: LF line endings, no trailing whitespace, final newlines present.");
