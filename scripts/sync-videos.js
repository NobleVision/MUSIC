import fs from "fs";
import path from "path";

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
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

const projectRoot = process.cwd();
const srcVideos = path.join(projectRoot, "public", "videos");
const destVideos = path.join(projectRoot, "client", "public", "videos");

if (!fs.existsSync(srcVideos)) {
  console.log(`ℹ No root videos directory found at ${srcVideos} (skipping)`);
  process.exit(0);
}

copyDir(srcVideos, destVideos);
console.log(`✓ Synced videos: ${srcVideos} -> ${destVideos}`);


