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

const funcConfig = {
  runtime: "nodejs20.x",
  handler: "index.js",
  launcherType: "Nodejs"
};

fs.writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(funcConfig, null, 2)
);

// Create package.json for the function to indicate ES module
const funcPackageJson = {
  type: "module"
};

fs.writeFileSync(
  path.join(funcDir, "package.json"),
  JSON.stringify(funcPackageJson, null, 2)
);

// Copy static files from dist/public to .vercel/output/static
const staticDir = path.join(outputDir, "static");
fs.mkdirSync(staticDir, { recursive: true });

function copyDir(src, dest) {
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

console.log("✓ Vercel Build Output API structure created");
