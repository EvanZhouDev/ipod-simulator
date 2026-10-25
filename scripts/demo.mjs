import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 8765);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/" || pathname === "/demo.html" || pathname === "/demo") {
      response.writeHead(302, { Location: "/demo/" }).end();
      return;
    }
    const relative = pathname;
    const target = resolve(root, `.${relative}${relative.endsWith("/") ? "index.html" : ""}`);
    if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": contentTypes[extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Demo: http://127.0.0.1:${port}/demo/`);
});
