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
  handler: "index.cjs", // Use .cjs extension for CommonJS
  launcherType: "Nodejs"
};

fs.writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(funcConfig, null, 2)
);

// Create package.json for the function with dependencies
// Explicitly set type to commonjs (or omit it) to ensure CommonJS is used
const rootPackageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
const funcPackageJson = {
  name: "vercel-function",
  version: "1.0.0",
  // Omit "type" field to use CommonJS (default)
  dependencies: {
    // Only include the externalized dependencies
    express: rootPackageJson.dependencies.express,
    "@trpc/server": rootPackageJson.dependencies["@trpc/server"],
    postgres: rootPackageJson.dependencies.postgres,
    "drizzle-orm": rootPackageJson.dependencies["drizzle-orm"],
    jose: rootPackageJson.dependencies.jose,
    cloudinary: rootPackageJson.dependencies.cloudinary,
    multer: rootPackageJson.dependencies.multer,
    cookie: rootPackageJson.dependencies.cookie,
    axios: rootPackageJson.dependencies.axios,
    zod: rootPackageJson.dependencies.zod,
    superjson: rootPackageJson.dependencies.superjson,
    nanoid: rootPackageJson.dependencies.nanoid,
    streamdown: rootPackageJson.dependencies.streamdown,
  },
};

fs.writeFileSync(
  path.join(funcDir, "package.json"),
  JSON.stringify(funcPackageJson, null, 2)
);

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

// For Vercel Build Output API with externalized dependencies, we need node_modules
// The simplest approach: copy the entire node_modules directory
// This is large but ensures all dependencies are available
const funcNodeModules = path.join(funcDir, "node_modules");

if (fs.existsSync("node_modules")) {
  console.log("Copying node_modules to function directory (this may take a while)...");
  try {
    // Use a more efficient copy method for large directories
    // For pnpm, we need to preserve symlinks or copy the actual files
    copyDir("node_modules", funcNodeModules);
    console.log("✓ node_modules copied successfully");
  } catch (error) {
    console.warn(`⚠ Error copying node_modules: ${error.message}`);
    console.warn("⚠ Function may not have access to externalized dependencies");
  }
} else {
  console.warn("⚠ node_modules not found - dependencies may not be available at runtime");
}

console.log("✓ Vercel Build Output API structure created");
