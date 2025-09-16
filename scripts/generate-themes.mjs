import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STATIC_THEMES_DIR = path.join(ROOT, 'static', 'themes');
const OUT_DIR = path.join(ROOT, 'src', 'lib', 'generated');
const OUT_FILE = path.join(OUT_DIR, 'themes.ts');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

async function listThemeDirs(base) {
  try {
    const entries = await fs.readdir(base, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function generate() {
  await ensureDir(OUT_DIR);

  const themeNames = await listThemeDirs(STATIC_THEMES_DIR);

  const records = [];
  for (const name of themeNames) {
    const manifestPath = path.join(STATIC_THEMES_DIR, name, 'theme-manifest.json');
    const stylesDir = path.join(STATIC_THEMES_DIR, name, 'styles');
    const manifestRaw = await readIfExists(manifestPath);
    if (!manifestRaw) continue;

    let manifest;
    try {
      manifest = JSON.parse(manifestRaw);
    } catch {
      continue;
    }

    const globalCss = await readIfExists(path.join(stylesDir, 'global.css'));
    const lightCss = await readIfExists(path.join(stylesDir, 'light.css'));
    const darkCss = await readIfExists(path.join(stylesDir, 'dark.css'));
    const componentsCss = await readIfExists(path.join(stylesDir, 'components.css'));

    records.push({ name, manifest, css: { globalCss, lightCss, darkCss, componentsCss } });
  }

  const lines = [];
  lines.push('// AUTO-GENERATED. Do not edit by hand.');
  lines.push('export type BundledTheme = {' );
  lines.push("  name: string;" );
  lines.push("  manifest: any;" );
  lines.push("  css: { globalCss?: string | null; lightCss?: string | null; darkCss?: string | null; componentsCss?: string | null };" );
  lines.push('};');
  lines.push('export const BUNDLED_THEMES: Record<string, BundledTheme> = {');
  for (const r of records) {
    const esc = (s) => (s == null ? 'null' : JSON.stringify(s));
    lines.push(`  ${JSON.stringify(r.name)}: {`);
    lines.push(`    name: ${JSON.stringify(r.name)},`);
    lines.push(`    manifest: ${JSON.stringify(r.manifest)},`);
    lines.push('    css: {');
    lines.push(`      globalCss: ${esc(r.css.globalCss)},`);
    lines.push(`      lightCss: ${esc(r.css.lightCss)},`);
    lines.push(`      darkCss: ${esc(r.css.darkCss)},`);
    lines.push(`      componentsCss: ${esc(r.css.componentsCss)},`);
    lines.push('    }');
    lines.push('  },');
  }
  lines.push('};');

  await fs.writeFile(OUT_FILE, lines.join('\n'), 'utf8');
  console.log(`[themes] Generated ${records.length} bundled themes to ${path.relative(ROOT, OUT_FILE)}`);
}

generate();


