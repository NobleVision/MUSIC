import fs from "fs";
import path from "path";

const outputDir = ".vercel/output";

// Create config.json for Vercel Build Output API
const config = {
  version: 3,
  routes: [
    {
      src: "/api/(.*)",
      dest: "/api/index"
    },
    {
      handle: "filesystem"
    },
    {
      src: "/(.*)",
      dest: "/index.html"
    }
  ]
};

// Write config.json
fs.writeFileSync(
  path.join(outputDir, "config.json"),
  JSON.stringify(config, null, 2)
);

// Create function config
const funcDir = path.join(outputDir, "functions/api/index.func");
fs.mkdirSync(funcDir, { recursive: true });

// Vercel function configuration
// Using .cjs extension to ensure Node.js treats it as CommonJS
const funcConfig = {
  runtime: "nodejs20.x",
  handler: "index.cjs",
  launcherType: "Nodejs",
  // Increase memory and timeout for API routes
  maxDuration: 30,
};

fs.writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(funcConfig, null, 2)
);

// Create a minimal package.json for the function.
// The function bundle is self-contained (we bundle dependencies into index.cjs),
// so we do not rely on installing node_modules at runtime.
const funcPackageJson = {
  name: "vercel-function",
  version: "1.0.0",
  main: "index.cjs",
};

fs.writeFileSync(
  path.join(funcDir, "package.json"),
  JSON.stringify(funcPackageJson, null, 2)
);

console.log("✓ Function package.json created");

// Copy static files from dist/public to .vercel/output/static
const staticDir = path.join(outputDir, "static");
fs.mkdirSync(staticDir, { recursive: true });

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Source directory does not exist: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir("dist/public", staticDir);

// Note: We do NOT copy node_modules here.
// The function bundle is self-contained (index.cjs).

console.log("✓ Vercel Build Output API structure created");
console.log("  - Static files: .vercel/output/static/");
console.log("  - Function: .vercel/output/functions/api/index.func/");
