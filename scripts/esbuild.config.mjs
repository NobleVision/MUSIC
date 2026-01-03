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

// Externalize packages that should be installed by Vercel at deploy time
// These will be required at runtime from node_modules
const external = [
  // Core server dependencies
  "express",
  "@trpc/server",
  "@trpc/server/adapters/express",
  // Database
  "postgres",
  "drizzle-orm",
  "drizzle-orm/*",
  // Authentication
  "jose",
  // Storage
  "cloudinary",
  // File uploads
  "multer",
  // Utilities
  "cookie",
  "axios",
  "zod",
  "superjson",
  "nanoid",
  "streamdown",
  // Exclude dotenv - Vercel provides env vars automatically
  "dotenv",
  "dotenv/*",
];

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

