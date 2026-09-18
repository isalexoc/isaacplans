/**
 * Does every route that can reach ffmpeg carry the binary?
 *
 * `ffmpeg-static` is spawned by path, not imported, so Next's file tracing cannot see it. Each
 * route that needs it has to be named in `outputFileTracingIncludes` in next.config.mjs — and when
 * one is missing, nothing complains at build time. It fails in production, only on Vercel, with
 * `spawn .../ffmpeg-static/ffmpeg ENOENT`, because locally the binary is simply sitting in
 * node_modules and everything works.
 *
 * That is what happened to the Call Study sharing route. This script makes the same mistake
 * impossible to ship quietly: it walks the import graph from every API route, finds the ones that
 * reach ffmpeg, and compares that set against the config.
 *
 *   pnpm check:ffmpeg           which routes need the binary, and whether they are listed
 *   pnpm check:ffmpeg --traced  also verify the last build actually included it
 *
 * No network, no database. Run it after adding a route that touches audio or video.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, dirname, resolve } from "path";

const ROOT = process.cwd();
const API_DIR = join(ROOT, "app", "api");
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

/** Resolve an import specifier to a file on disk, or null for a package import. */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;

  for (const ext of ["", ...EXTENSIONS]) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const ext of EXTENSIONS) {
    const candidate = join(base, "index" + ext);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specs: string[] = [];
  const patterns = [
    /import\s+[^"';]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) specs.push(m[1]);
  }
  return specs;
}

/** Does this file, or anything it imports, reference ffmpeg-static? */
function reachesFfmpeg(entry: string, cache: Map<string, boolean>, seen = new Set<string>()): boolean {
  const cached = cache.get(entry);
  if (cached !== undefined) return cached;
  if (seen.has(entry)) return false;
  seen.add(entry);

  const specs = importsOf(entry);
  if (specs.some((s) => s === "ffmpeg-static" || s.startsWith("ffmpeg-static/"))) {
    cache.set(entry, true);
    return true;
  }
  for (const spec of specs) {
    const target = resolveImport(spec, entry);
    if (target && reachesFfmpeg(target, cache, seen)) {
      cache.set(entry, true);
      return true;
    }
  }
  cache.set(entry, false);
  return false;
}

/** Every route.ts under app/api, as the "/api/..." path Next uses as a tracing key. */
function findRoutes(dir: string, out: { file: string; route: string }[] = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) findRoutes(full, out);
    else if (/^route\.(ts|js)$/.test(name)) {
      const rel = full.slice(join(ROOT, "app").length).replace(/\\/g, "/");
      out.push({ file: full, route: rel.replace(/\/route\.(ts|js)$/, "") });
    }
  }
  return out;
}

function configuredRoutes(): Set<string> {
  const source = readFileSync(join(ROOT, "next.config.mjs"), "utf8");
  const block = source.slice(source.indexOf("outputFileTracingIncludes"));
  return new Set([...block.matchAll(/["'](\/api\/[^"']+)["']/g)].map((m) => m[1]));
}

function tracedBinary(route: string): boolean | null {
  const nft = join(ROOT, ".next", "server", "app", route, "route.js.nft.json");
  if (!existsSync(nft)) return null;
  const files: string[] = JSON.parse(readFileSync(nft, "utf8")).files ?? [];
  return files.some((f) => /ffmpeg-static[\\/]ffmpeg(\.exe)?$/.test(f));
}

const checkTraced = process.argv.includes("--traced");
const cache = new Map<string, boolean>();
const routes = findRoutes(API_DIR);
const configured = configuredRoutes();

const needs = routes.filter((r) => reachesFfmpeg(r.file, cache)).map((r) => r.route).sort();
const missing = needs.filter((r) => !configured.has(r));
const stale = [...configured].filter((r) => !needs.includes(r)).sort();

console.log(`\n${routes.length} API routes scanned; ${needs.length} can reach ffmpeg.\n`);
for (const route of needs) {
  const listed = configured.has(route);
  let suffix = "";
  if (checkTraced) {
    const traced = tracedBinary(route);
    suffix = traced === null ? "   (no build output)" : traced ? "   binary traced" : "   BINARY NOT IN BUNDLE";
  }
  console.log(`  ${listed ? "listed  " : "MISSING "}${route}${suffix}`);
}

if (stale.length > 0) {
  console.log("\nListed in next.config.mjs but no longer reaches ffmpeg (safe to remove):");
  for (const route of stale) console.log(`  ${route}`);
}

if (missing.length > 0) {
  console.log(
    `\n${missing.length} route(s) will throw "spawn ... ffmpeg ENOENT" on Vercel.` +
      `\nAdd them to outputFileTracingIncludes in next.config.mjs.\n`
  );
  process.exit(1);
}

console.log("\nEvery route that reaches ffmpeg is listed.\n");
process.exit(0);
