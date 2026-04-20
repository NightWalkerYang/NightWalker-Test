const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OUT = __dirname;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(OUT, 'javadoc_meta.js'), 'utf8') + '; this.__meta = meta;', ctx);
const M = ctx.__meta;

const modulesDir = path.join(OUT, 'modules');
fs.mkdirSync(modulesDir, { recursive: true });

// --- INDEX.md — top-level module catalog ---
const byCloud = {};
for (const m of M.modules) {
  const cloud = m.cloud || 'misc';
  (byCloud[cloud] = byCloud[cloud] || []).push(m);
}

const indexLines = [];
indexLines.push(`# Kingdee ${M.cosmicVersion} — Module Index`);
indexLines.push('');
indexLines.push(`Generated: ${M.lastGen} · Modules: ${M.modules.length}`);
indexLines.push('');
indexLines.push('Each entry links to `modules/<module>.md` listing that module\'s packages and classes.');
indexLines.push('Columns: **name** — description (packages / classes)');
indexLines.push('');

for (const cloud of Object.keys(byCloud).sort()) {
  indexLines.push(`## Cloud: ${cloud}`);
  indexLines.push('');
  for (const m of byCloud[cloud].sort((a, b) => a.name.localeCompare(b.name))) {
    const pkgCount = (m.PS || []).length;
    const clsCount = (m.PS || []).reduce((s, p) => s + (p.CS || []).length, 0);
    const desc = (m.desc || '').replace(/\|/g, '\\|');
    indexLines.push(`- [\`${m.name}\`](modules/${m.name}.md) — ${desc} (${pkgCount}p/${clsCount}c) app=${m.app} isv=${m.isv}`);
  }
  indexLines.push('');
}
fs.writeFileSync(path.join(OUT, 'INDEX.md'), indexLines.join('\n'));

// --- Per-module files ---
const CLASS_TYPE = { 0: 'class', 1: 'interface', 2: 'enum', 3: 'annotation' };

for (const m of M.modules) {
  const lines = [];
  lines.push(`# ${m.name}`);
  lines.push('');
  lines.push(`**${m.desc || ''}** · app=\`${m.app}\` cloud=\`${m.cloud}\` isv=\`${m.isv}\``);
  lines.push('');
  lines.push('Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`');
  lines.push('Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`');
  lines.push('');
  lines.push('Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:');
  lines.push('`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.');
  lines.push('');
  lines.push('## Packages');
  lines.push('');

  for (const pkg of (m.PS || [])) {
    const pkgPath = pkg.N.replace(/\./g, '/');
    lines.push(`### \`${pkg.N}\``);
    lines.push('');
    lines.push(`Path prefix: \`javadoc/${pkgPath}/\``);
    lines.push('');
    lines.push('| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |');
    lines.push('|-------|------|---------|------------|---------|--------|------------|');
    for (const c of (pkg.CS || [])) {
      const kind = CLASS_TYPE[c.T] ?? `T${c.T}`;
      const extend = c.S ? `\`${c.S}\`` : '';
      const impl = (c.IS || []).map(i => `\`${i}\``).join(', ');
      const methods = (c.MS || []).length;
      const fields = (c.FS || []).length;
      const dep = c._U ? 'yes' : '';
      const name = c.N.replace(/\|/g, '\\|');
      lines.push(`| \`${name}\` | ${kind} | ${extend} | ${impl} | ${methods} | ${fields} | ${dep} |`);
    }
    lines.push('');
  }

  fs.writeFileSync(path.join(modulesDir, m.name + '.md'), lines.join('\n'));
}

console.log(`Wrote INDEX.md and ${M.modules.length} module files to modules/`);
