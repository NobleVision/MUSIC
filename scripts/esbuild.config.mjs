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

// Bundle everything into a single CommonJS file.
// Vercel Build Output API does NOT reliably ship node_modules alongside the function,
// so any externalized dependency (like express) will be missing at runtime.
// CommonJS output also avoids ESM + CJS dynamic-require issues.
const external = [];

async function buildVercel() {
  try {
    // Ensure output directory exists
    const funcDir = resolve(projectRoot, ".vercel/output/functions/api/index.func");

    await build({
      entryPoints: [resolve(projectRoot, "server/api-entry.ts")],
      bundle: true,
      platform: "node",
      format: "cjs", // Use CommonJS to be compatible with Express
      target: "node20",
      // Use .cjs extension to ensure CommonJS is recognized by Node.js
      outfile: resolve(funcDir, "index.cjs"),
      external,
      alias,
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      logLevel: "info",
      sourcemap: false,
      minify: false, // Keep readable for debugging
      // Banner to ensure CommonJS compatibility
      banner: {
        js: `// Vercel Serverless Function - CommonJS format
// Built by esbuild for Node.js 20.x runtime`,
      },
    });

    console.log("✓ Vercel function bundled successfully to index.cjs");
  } catch (error) {
    console.error("✗ Build failed:", error);
    process.exit(1);
  }
}

buildVercel();

