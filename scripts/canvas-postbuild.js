const fs = require('fs').promises;
const path = require('path');

async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

async function copyFile(src, dest) {
    await ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
}

async function copyDir(srcDir, destDir) {
    let entries;
    try {
        entries = await fs.readdir(srcDir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.warn('[canvas-postbuild] source dir does not exist:', srcDir);
            return;
        }
        throw err;
    }

    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else if (entry.isFile()) {
            await copyFile(srcPath, destPath);
            console.log('[canvas-postbuild] copied', srcPath, '->', destPath);
        }
    }
}

async function main() {
    const repoRoot = path.resolve(__dirname, '..');
    const src = path.join(repoRoot, 'apps', 'canvas', 'public', 'realtime');
    const dest = path.join(repoRoot, 'backend', 'app', 'static', 'canvas', 'realtime');

    console.log('[canvas-postbuild] copying realtime public files from', src, 'to', dest);
    await copyDir(src, dest);
    console.log('[canvas-postbuild] done');
}

main().catch(err => {
    console.error('[canvas-postbuild] error:', err);
    process.exit(1);
});