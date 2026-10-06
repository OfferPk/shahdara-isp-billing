import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('.', import.meta.url);
const dist = new URL('./dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html','styles.css','app.js','profile-labels.js','profile-ui.js','receipt.js','core.js','phase3.js','sw.js','manifest.webmanifest','icon.svg']) {
  await cp(new URL(`./${file}`, root), new URL(`./dist/${file}`, root));
}
console.log('Built static app in dist/');
