// Lets plain Node (scripts and tests) load app code the way Next.js does:
//   - "@/x" resolves to "src/x"
//   - imports without an extension try ".js" and "/index.js"
// Used with: node --conditions=react-server --import ./scripts/register-hooks.mjs ...
// ("react-server" makes the `server-only` package a no-op outside Next.js.)
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = pathToFileURL(fileURLToPath(new URL("../src/", import.meta.url)));

function withExtension(url) {
  const path = fileURLToPath(url);
  if (existsSync(path) && statSync(path).isFile()) return url;
  for (const candidate of [`${path}.js`, `${path}/index.js`]) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return url;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(withExtension(new URL(specifier.slice(2), SRC).href), context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith(SRC.href)) {
    return nextResolve(withExtension(new URL(specifier, context.parentURL).href), context);
  }
  return nextResolve(specifier, context);
}
