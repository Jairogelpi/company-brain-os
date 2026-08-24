import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");
const canonicalRoots = [
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "DEPLOY.md",
  "CHANGELOG.md",
  "docs",
];
const excludedPrefixes = [
  `${path.join("docs", "archive")}${path.sep}`,
  `${path.join("docs", "superpowers")}${path.sep}`,
];
const violations = [];

async function collectMarkdown(relativePath) {
  const absolute = path.join(repoRoot, relativePath);
  const info = await stat(absolute);
  if (info.isFile()) return relativePath.endsWith(".md") ? [relativePath] : [];

  const files = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const child = path.join(relativePath, entry.name);
    if (excludedPrefixes.some((prefix) => `${child}${entry.isDirectory() ? path.sep : ""}`.startsWith(prefix))) continue;
    if (entry.isDirectory()) files.push(...(await collectMarkdown(child)));
    else if (entry.name.endsWith(".md")) files.push(child);
  }
  return files;
}

const files = [];
for (const root of canonicalRoots) files.push(...(await collectMarkdown(root)));

for (const relativeFile of files) {
  const absoluteFile = path.join(repoRoot, relativeFile);
  const text = await readFile(absoluteFile, "utf8");

  const staleChecks = [
    [/Next\.js\s+1[0-5](?:\.|\b)/gi, "canonical documentation references a pre-16 Next.js version"],
    [/Until versioned releases are published/gi, "canonical documentation still claims no versioned release exists"],
  ];

  for (const [pattern, message] of staleChecks) {
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      violations.push(`${relativeFile}:${line} ${message}`);
    }
  }

  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (!target || target.startsWith("#") || /^(?:https?:|mailto:)/i.test(target)) continue;
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    target = target.split("#", 1)[0].split("?", 1)[0];
    if (!target) continue;

    let decoded;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      decoded = target;
    }

    const resolved = path.resolve(path.dirname(absoluteFile), decoded);
    if (!resolved.startsWith(repoRoot + path.sep) && resolved !== repoRoot) {
      const line = text.slice(0, match.index).split("\n").length;
      violations.push(`${relativeFile}:${line} relative link escapes repository: ${target}`);
      continue;
    }

    try {
      await stat(resolved);
    } catch {
      const line = text.slice(0, match.index).split("\n").length;
      violations.push(`${relativeFile}:${line} broken relative link: ${target}`);
    }
  }
}

if (violations.length) {
  console.error("Canonical documentation audit failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Documentation audit passed: ${files.length} canonical Markdown files checked for relative links and stale release/framework references.`);
