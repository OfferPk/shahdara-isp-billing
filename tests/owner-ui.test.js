import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const index=read('index.html'),app=read('app.js'),ui=read('owner-ui.js'),styles=read('styles.css'),worker=read('sw.js'),build=read('build.mjs');

test('phone-first navigation and the Owner Center expose the requested local views',()=>{
  for(const label of ['Home','Customers','Collection','Reports','More'])assert.match(index,new RegExp(`>${label}</button>`));
  for(const id of ['ownerCommandCenter','ownerCommandInput','ownerCommandAnswer','savedMonthlyClosings','compareMonthA','compareMonthB','monthComparisonMetrics','performanceExplainForm','customerRankingResults','duesRecoveryGroups'])assert.ok(index.includes(`id="${id}"`),`${id} is present`);
  assert.match(ui,/data-mobile-nav/);
  const navHandler=ui.slice(ui.indexOf("document.querySelectorAll('[data-mobile-nav]')"),ui.indexOf("document.querySelectorAll('[data-mobile-more]')"));
  assert.match(navHandler,/if\(action==='more'\)[\s\S]*?return;/,'More retains the visibility state set by its dedicated toggle listener');
  assert.match(styles,/@media\(max-width:620px\)[\s\S]*\.mobile-bottom-nav\{position:fixed/);
});

test('voice requests require an available installed local model and recognized text never runs automatically',()=>{
  assert.match(ui,/Constructor\.available\(\{langs:\[language\],processLocally:true\}\)/);
  assert.match(ui,/recognition\.processLocally=true/);
  assert.match(ui,/no online speech fallback was used/i);
  assert.match(ui,/Review it and tap Ask/);
  assert.doesNotMatch(ui,/fetch\s*\(|sendBeacon|webkitSpeechRecognition[^;]*remote/i);
});

test('monthly closing, comparisons and rankings are offline assets and use saved-data helpers',()=>{
  assert.match(app,/autoClosePreviousMonth\(state, new Date\(\)\)/);
  assert.match(ui,/buildMonthToMonthComparison\(getState\(\)/);
  assert.match(ui,/explainBusinessPerformance\(getState\(\)/);
  assert.match(ui,/buildCustomerRankings\(getState\(\)/);
  assert.ok(worker.includes("'./owner-insights.js'"));
  assert.ok(worker.includes("'./owner-ui.js'"));
  assert.ok(build.includes("'owner-insights.js'"));
  assert.ok(build.includes("'owner-ui.js'"));
});

test('WhatsApp recovery remains owner-triggered and offers templates without background sending',()=>{
  for(const template of ['friendly','overdue','final','payment-confirmation'])assert.ok(ui.includes(template));
  assert.match(ui,/target="_blank" rel="noopener noreferrer"/);
  assert.match(ui,/Review WhatsApp draft/);
  assert.match(ui,/data-open-recovery-customer/);
  assert.doesNotMatch(ui,/fetch\s*\(|sendBeacon|window\.open\s*\(|sendText|autoSend/i);
});

test('user-provided mohalla values are optional suggestions, not seeded customer assignments',()=>{
  for(const name of ['MOHALLA CHARYAA','MOHALLA KISHTI','MOHALLA BARRIAN','MOHALLA MALLA','MOHALLA THALII','MOHALLA CHAMYAA','MOHALLA NAKAR','MOHALLA PALALIYAA','MOHALAA BANI','MOHALLA SODAA','MOHALLA HAVELI','MOHALLA CHUDRIYAA','MOHALLA PULL','MOHALLA SHAHDARA PARK'])assert.ok(index.includes(`value="${name}"`),`${name} is suggested`);
  assert.match(index,/id="mohallaInput"[^>]*list="mohallaOptions"/);
});
