import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const PKG_NAME = 'kr-router';

async function writePackageJson(outputPath: string, moduleName: string) {
  const content = {
    name: moduleName,
    type: 'module',
    main: `${outputPath.replace('dist/', '')}/index.js`,
    module: `${outputPath.replace('dist/', '')}/index.js`,
    types: `${outputPath.replace('dist/', '')}/index.d.ts`,
    sideEffects: false
  };
  await fs.writeFile(path.join(outputPath, 'package.json'), JSON.stringify(content, null, 2), 'utf-8');
}

async function generateMainPackage() {
  const targets = [
    { dir: 'esm', moduleType: 'module' },
    { dir: 'cjs', moduleType: 'commonjs' }
  ];

  for (const target of targets) {
    const outDir = path.join(DIST_DIR, target.dir);
    const indexFile = path.join(outDir, 'index.js');

    await fs.mkdir(outDir, { recursive: true });
    // await fs.writeFile(
    //   indexFile,
    //   `export * from '../packages/main/index.js';`,
    //   'utf-8'
    // );
  }

  // Generate dist/package.json with correct relative paths
  const finalPkgPath = path.join(DIST_DIR, 'package.json');
  const finalPkgContent = {
    name: PKG_NAME,
    type: 'module',
    main: './cjs/index.js',
    module: './esm/index.js',
    types: './types/index.d.ts',
    sideEffects: false
  };

  await fs.writeFile(finalPkgPath, JSON.stringify(finalPkgContent, null, 2), 'utf-8');
  console.log(`✅ Generated ${finalPkgPath} with correct relative paths`);
}


async function main() {
  try {
    await generateMainPackage();
    console.log('✅ Package files generated successfully.');
  } catch (err) {
    console.error('❌ Failed to generate package files:', err);
    process.exit(1);
  }
}

main().catch();
