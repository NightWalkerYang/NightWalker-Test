const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://dev.kingdee.com/sdk/Cosmic%20V7.0.1';
const OUT = __dirname;

// Load meta via vm sandbox
const vm = require('vm');
const metaSrc = fs.readFileSync(path.join(OUT, 'javadoc_meta.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(metaSrc + '; this.__meta = meta;', ctx);
const M = ctx.__meta;

// Build URL list
const tasks = [];
for (const mod of M.modules) {
  for (const pkg of (mod.PS || [])) {
    const pkgPath = pkg.N.replace(/\./g, '/');
    for (const cls of (pkg.CS || [])) {
      // Nested class names use "." in meta but HTML file uses "."
      const clsFile = cls.N + '.html';
      const relPath = `javadoc/${pkgPath}/${clsFile}`;
      tasks.push({
        url: `${BASE}/${relPath}`,
        out: path.join(OUT, relPath.replace(/\//g, path.sep)),
      });
    }
  }
}

console.log(`Total files to download: ${tasks.length}`);

// Ensure dirs
const dirs = new Set(tasks.map(t => path.dirname(t.out)));
for (const d of dirs) fs.mkdirSync(d, { recursive: true });

let done = 0, failed = 0, skipped = 0;
const failures = [];

function download(task) {
  return new Promise((resolve) => {
    if (fs.existsSync(task.out) && fs.statSync(task.out).size > 0) {
      skipped++; done++; resolve();
      return;
    }
    const req = https.get(task.url, (res) => {
      if (res.statusCode !== 200) {
        failed++; done++;
        failures.push({ url: task.url, status: res.statusCode });
        res.resume();
        resolve();
        return;
      }
      const file = fs.createWriteStream(task.out);
      res.pipe(file);
      file.on('finish', () => { file.close(); done++; resolve(); });
      file.on('error', (e) => { failed++; done++; failures.push({ url: task.url, err: e.message }); resolve(); });
    });
    req.on('error', (e) => { failed++; done++; failures.push({ url: task.url, err: e.message }); resolve(); });
    req.setTimeout(30000, () => { req.destroy(); failed++; done++; failures.push({ url: task.url, err: 'timeout' }); resolve(); });
  });
}

async function run() {
  const CONCURRENCY = 20;
  let idx = 0;
  const started = Date.now();
  const workers = Array(CONCURRENCY).fill(0).map(async () => {
    while (idx < tasks.length) {
      const i = idx++;
      await download(tasks[i]);
      if (done % 200 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`[${done}/${tasks.length}] skipped=${skipped} failed=${failed} rate=${rate.toFixed(1)}/s`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`\nDone. total=${tasks.length} ok=${done - failed} skipped=${skipped} failed=${failed}`);
  if (failures.length) {
    fs.writeFileSync(path.join(OUT, 'failures.json'), JSON.stringify(failures, null, 2));
    console.log(`Failures saved to failures.json`);
  }
}

run();
