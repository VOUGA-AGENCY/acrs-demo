// Static file preview only. No application API, data storage or business logic.
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
const root = path.resolve("out");
if (!existsSync(root)) {
  console.error("Execute pnpm build antes de pnpm start.");
  process.exit(1);
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
http
  .createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    let file = path.resolve(root, "." + url);
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory())
      file = existsSync(file + ".html") ? file + ".html" : path.join(file, "index.html");
    if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
    if (!existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/html" });
      createReadStream(path.join(root, "404.html")).pipe(res);
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(file).pipe(res);
  })
  .listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () =>
    console.log(`ACRS demo: http://127.0.0.1:${process.env.PORT ?? 3000}`),
  );
