import { cp, mkdir, rm } from 'node:fs/promises';
const root = new URL('.', import.meta.url);
const dist = new URL('./dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html','styles.css','dashboard.css','nav.css','app.js','dashboard.js','dashboard-charts.js','dashboard-collection-target.js','dashboard-dues-aging.js','nav.js','nav-collection-rounds.js','nav-quick-collect.js','nav-customer-search.js','nav-quick-profile.js','nav-pending-actions.js','form-validation.js','profile-labels.js','profile-ui.js','receipt.js','package-catalog.js','core.js','phase3.js','owner-insights.js','owner-ui.js','backup-store.js','duplicate-detection.js','sw.js','manifest.webmanifest','icon.svg']) {
  await cp(new URL(`./${file}`, root), new URL(`./dist/${file}`, root));
}
console.log('Built static app in dist/');
