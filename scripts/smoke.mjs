// Smoke test of the built site (web/out with admin in web/out/admin), served under /MyFlix like GitHub Pages.
// Checks the public pages render, the sign-in screens load, and nothing throws in the browser.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const root = normalize(process.argv[2] ?? "web/out");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!p.startsWith("/MyFlix")) return res.writeHead(404).end();
  p = p.slice("/MyFlix".length) || "/";
  let file = join(root, p);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = file.endsWith(".html") ? file : `${file}.html`;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(3199, r));

const checks = [
  ["/MyFlix/", /MYFLIX|MyFlix/],
  ["/MyFlix/terms/", /Terms/],
  ["/MyFlix/privacy/", /Privacy/],
  ["/MyFlix/cookies/", /Cookie/],
  ["/MyFlix/paid/", /all set/],
  ["/MyFlix/login/", /Sign In|getting ready/],
  ["/MyFlix/admin/login/", /Staff sign in/],
];

const browser = await chromium.launch();
let failed = 0;
for (const [path, expect] of checks) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`http://localhost:3199${path}`, { waitUntil: "networkidle", timeout: 30000 });
    const text = await page.locator("body").innerText();
    const ok = expect.test(text) && errors.length === 0;
    console.log(`${ok ? "PASS" : "FAIL"}  ${path}${errors.length ? `  (errors: ${errors.join("; ")})` : ok ? "" : "  (expected text missing)"}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`FAIL  ${path}  (${e.message})`);
    failed++;
  }
  await page.close();
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
