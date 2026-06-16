// Copies the pdf.js worker into /public so it can be served as a static asset
// and referenced at runtime. pdf.js needs its worker loaded from a same-origin
// URL; bundling it through Turbopack + `output: export` is fragile, so we just
// ship the prebuilt worker file verbatim. Runs on predev / prebuild.
//
// We ship it as `.js` (not the upstream `.mjs`): module workers and dynamic
// `import()` require a JavaScript MIME type, and some static hosts (e.g. the
// production DomaiNesia host) don't map `.mjs` to a Content-Type at all, which
// makes the browser refuse the module ("Failed to fetch dynamically imported
// module"). `.js` is universally served as application/javascript.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const root = join(__dirname, "..");
const publicDir = join(root, "public");
const dest = join(publicDir, "pdf.worker.min.js");

// Resolve the worker relative to the installed pdfjs-dist package so we don't
// hardcode a node_modules path that could move.
let src;
try {
  const pkg = require.resolve("pdfjs-dist/package.json");
  src = join(dirname(pkg), "build", "pdf.worker.min.mjs");
} catch {
  console.warn("[copy-pdf-worker] pdfjs-dist not installed yet — skipping.");
  process.exit(0);
}

if (!existsSync(src)) {
  console.warn(`[copy-pdf-worker] worker not found at ${src} — skipping.`);
  process.exit(0);
}

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] → public/pdf.worker.min.js`);
