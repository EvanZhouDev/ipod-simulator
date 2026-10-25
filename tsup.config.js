import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.js",
    "react/index": "src/react/index.js",
    "element/index": "src/element.js",
  },
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  splitting: true,
  clean: true,
  // Keep the device module beside its assets for direct browser/CDN imports.
  external: ["react", "./includes/ipod/web-music-ipod.esm.js"],
  async onSuccess() {
    await cp("src/includes", "dist/includes", { recursive: true });
    await cp("src/index.d.ts", "dist/index.d.ts");
    await mkdir("dist/react", { recursive: true });
    await cp("src/react/index.d.ts", "dist/react/index.d.ts");
    // Preserve the client boundary in frameworks that consume the React adapter.
    const react = await readFile("dist/react/index.js", "utf8");
    if (!react.startsWith('"use client";')) await writeFile("dist/react/index.js", '"use client";\n' + react);
    await writeFile("dist/element/index.d.ts", 'import "../index.js";\n');
  },
});
