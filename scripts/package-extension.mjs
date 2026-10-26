import { cp, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { zipSync } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist-extension");
// Vite builds only the shared React application. Add the extension shell after
// that build so the ordinary website never registers the extension worker.
await cp(path.join(root, "extension"), output, { recursive: true });
const files = {};
async function collect(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      await collect(path.join(directory, entry.name), `${relative}/`);
    else
      files[relative] = new Uint8Array(
        await readFile(path.join(directory, entry.name)),
      );
  }
}
await collect(output);
if (
  !files["manifest.json"] ||
  !files["index.html"] ||
  !files["background.js"]
) {
  throw new Error("Incomplete extension build. Run npm run build:extension.");
}
await writeFile(
  path.join(root, "instagram-follow-checker-extension.zip"),
  zipSync(files, { level: 9 }),
);
console.log(
  "Extension ready: dist-extension/ (Load unpacked) and instagram-follow-checker-extension.zip (extract or submit to the store).",
);
