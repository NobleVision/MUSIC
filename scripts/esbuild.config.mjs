import { build } from "esbuild";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Read tsconfig to get path aliases
const tsconfig = JSON.parse(readFileSync(resolve(projectRoot, "tsconfig.json"), "utf-8"));
const paths = tsconfig.compilerOptions?.paths || {};
const baseUrl = tsconfig.compilerOptions?.baseUrl || ".";

// Convert TypeScript path aliases to esbuild alias format
// esbuild alias automatically handles subpaths (e.g., @shared/const -> shared/const)
const alias = {};
for (const [aliasPath, pathArray] of Object.entries(paths)) {
  // Remove the /* suffix for the pattern
  const pattern = aliasPath.replace("/*", "");
  // Resolve the target path (remove /* from the target too)
  const targetPath = pathArray[0].replace("/*", "");
  const target = resolve(projectRoot, baseUrl, targetPath);
  alias[pattern] = target;
}

// For Vercel Build Output API, we need to bundle everything into a single file
// dotenv is not imported in api-entry.ts (Vercel provides env vars automatically)
// Only externalize packages that cannot be bundled (native modules, etc.)
const external = [
  // Only externalize if absolutely necessary (native bindings, etc.)
  // Most packages should be bundled
];

async function buildVercel() {
  try {
    await build({
      entryPoints: [resolve(projectRoot, "server/api-entry.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node20",
      outfile: resolve(projectRoot, ".vercel/output/functions/api/index.func/index.js"),
      external,
      alias,
      // Don't use packages option - just bundle everything by default with bundle: true
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      logLevel: "info",
      sourcemap: false,
      minify: false, // Keep readable for debugging
    });

    console.log("✓ Vercel function bundled successfully");
  } catch (error) {
    console.error("✗ Build failed:", error);
    process.exit(1);
  }
}

buildVercel();

