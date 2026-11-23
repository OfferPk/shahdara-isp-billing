// WhatsApp Templates & Campaign Queue polish: two tabs (Campaign Queue
// first, Templates second), the six editors as accordions, a segmented
// language toggle, and a draft that survives a language switch.
// PINNING FILE: asserts the NEW parity total. It must not contain the
// previous total in any form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TRANSLATIONS } from '../nav-language.js';
import {
  WA_TEMPLATE_IDS, getWaTemplates,
  waStudioDraftKey, captureWaStudioDraft, waStudioDraftBody, clearWaStudioDrafts
} from '../whatsapp-templates.js';
import { SCREENS } from '../screen-router.js';

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const routerSrc = readFileSync(new URL('../screen-router.js', import.meta.url), 'utf8');

// The WhatsApp Templates view, from its opening section tag to the next
// top-level view — the only region these markup tests may search.
const waViewStart = indexSrc.indexOf('<section id="waTemplatesView"');
const waViewEnd = indexSrc.indexOf('<section id="easypaisaView"');
const waView = indexSrc.slice(waViewStart, waViewEnd);

// The studio renderer, from its declaration to the campaign-template
// helper that follows it.
const studioStart = appSrc.indexOf('function waRenderStudio()');
const studioEnd = appSrc.indexOf('function waCampaignTemplateFor(');
const studioSrc = appSrc.slice(studioStart, studioEnd);

test('tabs: Campaign Queue is the first tab and active by default; Templates starts hidden', () => {
  assert.ok(waView.includes('role="tablist"'), 'tab bar exists');
  const campaignTab = waView.indexOf('id="waTabCampaign"');
  const templatesTab = waView.indexOf('id="waTabTemplates"');
  assert.ok(campaignTab > -1 && templatesTab > -1, 'both tabs exist');
  assert.ok(campaignTab < templatesTab, 'Campaign Queue is the first tab');
  const campaignBtn = waView.slice(campaignTab, waView.indexOf('</button>', campaignTab));
  assert.ok(campaignBtn.includes('aria-selected="true"'), 'Campaign tab selected');
  assert.ok(campaignBtn.includes('aria-controls="waCampaignPanel"'), 'Campaign tab controls its panel');
  const templatesBtn = waView.slice(templatesTab, waView.indexOf('</button>', templatesTab));
  assert.ok(templatesBtn.includes('aria-selected="false"'), 'Templates tab not selected');
  assert.ok(templatesBtn.includes('aria-controls="waTemplatesPanel"'), 'Templates tab controls its panel');
  const campaignPanel = waView.indexOf('id="waCampaignPanel"');
  const templatesPanel = waView.indexOf('id="waTemplatesPanel"');
  assert.ok(campaignPanel > -1 && templatesPanel > -1, 'both panels exist');
  assert.ok(campaignPanel < templatesPanel, 'Campaign panel comes first in the DOM');
  const campaignPanelTag = waView.slice(campaignPanel, waView.indexOf('>', campaignPanel));
  assert.ok(!campaignPanelTag.includes('hidden'), 'Campaign panel visible by default');
  const templatesPanelTag = waView.slice(templatesPanel, waView.indexOf('>', templatesPanel));
  assert.ok(templatesPanelTag.includes('hidden'), 'Templates panel hidden by default');
  assert.equal((waView.match(/role="tab"/g) || []).length, 2, 'exactly two tabs');
});

test('tabs: the two tab labels are keyed in EN + UR', () => {
  assert.equal(TRANSLATIONS.en.wa_tab_campaign, 'Campaign Queue');
  assert.equal(TRANSLATIONS.ur.wa_tab_campaign, 'مہم کی قطار');
  assert.equal(TRANSLATIONS.en.wa_tab_templates, 'Templates');
  assert.equal(TRANSLATIONS.ur.wa_tab_templates, 'ٹیمپلیٹس');
  assert.ok(waView.includes('data-i18n="wa_tab_campaign"'), 'Campaign tab label is keyed');
  assert.ok(waView.includes('data-i18n="wa_tab_templates"'), 'Templates tab label is keyed');
});

test('tabs: the header action clicks the Campaign tab, and the tab wiring applies the tab state once', () => {
  assert.deepEqual(SCREENS.waTemplates.action, { label: 'Start Campaign', click: '#waTabCampaign' });
  assert.ok(!routerSrc.includes("focus: '#waCampaignStart'"), 'no focus action on the Start button remains');
  assert.ok(appSrc.includes('campaignTab.dataset.waWired'), 'Campaign tab wired once');
  assert.ok(appSrc.includes('templatesTab.dataset.waWired'), 'Templates tab wired once');
  assert.ok(appSrc.includes('waSetTab(waShowTab)'), 'the stored tab is applied on render');
  const setter = appSrc.slice(appSrc.indexOf('function waSetTab('), appSrc.indexOf('function waRenderStudio()'));
  assert.ok(setter.includes("campaignPanel.hidden = name !== 'campaign'"), 'setter hides the Campaign panel off-tab');
  assert.ok(setter.includes("templatesPanel.hidden = name !== 'templates'"), 'setter hides the Templates panel off-tab');
  assert.ok(setter.includes("setAttribute('aria-selected'"), 'setter moves aria-selected');
});

test('copy: no duplicate heading, and the one description line counts six with no code variable in it', () => {
  assert.ok(!waView.includes('waTemplatesHeading'), 'no dangling heading id');
  assert.ok(!waView.includes('<h2'), 'no second h2 in the view');
  assert.ok(!waView.includes('five messages'), 'the wrong count is gone');
  assert.ok(waView.includes('Edit the six messages'), 'the corrected count is present');
  assert.ok(!waView.includes('lastRemindedAt'), 'no code variable leaks into user text');
  assert.ok(waView.includes('aria-label="WhatsApp Templates"'), 'section labelled without the removed heading');
  assert.ok(waView.includes('Local only'), 'the Local only badge stays');
});

test('copy: the campaign helper sits above the Start button, and the no-campaign card renders nothing', () => {
  const help = waView.indexOf('id="waCampaignHelp"');
  const toolbar = waView.indexOf('class="table-filter-toolbar"');
  const start = waView.indexOf('id="waCampaignStart"');
  assert.ok(help > -1 && toolbar > -1 && start > -1, 'helper, toolbar and Start button exist');
  assert.ok(help < toolbar && toolbar < start, 'helper is above the toolbar that holds Start');
  assert.ok(waView.slice(help, waView.indexOf('</p>', help)).includes('Start a campaign to step through unpaid customers one by one.'), 'helper wording');
  assert.ok(!appSrc.includes('Start a campaign below'), 'the wrong "below" wording is gone');
  const cardFn = appSrc.slice(appSrc.indexOf('function waCampaignCardHtml()'), appSrc.indexOf('function waRenderCampaignCurrent()'));
  assert.ok(cardFn.includes("if (!waCampaign) return '';"), 'no-campaign branch renders nothing');
});

test('toggle: the language switch is a segmented control with a visible active state, never disabled', () => {
  assert.ok(studioSrc.includes('class="ds-segmented"'), 'segmented container');
  assert.ok(studioSrc.includes('class="ds-segmented__button"'), 'segmented buttons');
  assert.ok(studioSrc.includes('aria-selected="'), 'active state via aria-selected');
  assert.ok(studioSrc.includes('aria-pressed="'), 'active state via aria-pressed');
  assert.ok(!studioSrc.includes('disabled'), 'no disabled button in the studio');
  assert.ok(!studioSrc.includes('secondary-button'), 'no greyed secondary-button toggle');
  assert.ok(!studioSrc.includes('table-filter-toolbar'), 'the toggle no longer uses the filter toolbar');
});

test('toggle: an unsaved edit survives a language switch and never leaks across variants', () => {
  const drafts = {};
  const id = 'politeReminder';
  const savedRoman = getWaTemplates(null).find(entry => entry.id === id).roman;
  const savedUrdu = getWaTemplates(null).find(entry => entry.id === id).urdu;
  // Render in Roman Urdu, edit, switch to Urdu: the Urdu textarea shows
  // its saved text, not the Roman edit.
  assert.equal(waStudioDraftBody(drafts, id, 'roman', savedRoman), savedRoman);
  captureWaStudioDraft(drafts, id, 'roman', 'EDITED roman draft {name}');
  assert.equal(waStudioDraftBody(drafts, id, 'roman', savedRoman), 'EDITED roman draft {name}');
  assert.equal(waStudioDraftBody(drafts, id, 'urdu', savedUrdu), savedUrdu, 'no cross-variant leak');
  // Switch back: the Roman edit is still there.
  assert.equal(waStudioDraftBody(drafts, id, 'roman', savedRoman), 'EDITED roman draft {name}');
  // An empty edit is a real draft too — it must not fall back to saved text.
  captureWaStudioDraft(drafts, id, 'roman', '');
  assert.equal(waStudioDraftBody(drafts, id, 'roman', savedRoman), '');
});

test('accordion: six editors collapse into accordions, first open, one label each', () => {
  assert.equal(WA_TEMPLATE_IDS.length, 6, 'six templates');
  assert.ok(studioSrc.includes('<details class="profile-accordion wa-template-accordion"'), 'accordion cards');
  assert.ok(studioSrc.includes('data-wa-accordion="${template.id}"'), 'one accordion per template');
  assert.ok(studioSrc.includes("${open ? ' open' : ''}"), 'open attribute is conditional');
  assert.ok(studioSrc.includes('waStudioOpen === template.id'), 'open card follows the stored open id');
  assert.ok(appSrc.includes("let waStudioOpen = 'billGenerated';"), 'first template open by default');
  assert.ok(studioSrc.includes('<summary>${escapeHtml(WA_TEMPLATE_LABELS[template.id])}</summary>'), 'summary carries the label');
  assert.ok(studioSrc.includes('<h3>${escapeHtml(WA_TEMPLATE_LABELS[template.id])}</h3>'), 'open title is the h3 inside the body');
  assert.ok(!studioSrc.includes('<p class="eyebrow">'), 'no overline repeating the title');
  assert.ok(!studioSrc.includes('wa-template-card'), 'no fully-open card markup remains');
});

test('accordion: opening one card closes the others directly, without a re-render', () => {
  const toggleAt = studioSrc.indexOf("addEventListener('toggle'");
  assert.ok(toggleAt > -1, 'toggle handler exists');
  const handler = studioSrc.slice(toggleAt, studioSrc.indexOf("host.querySelectorAll('[data-wa-lang]')"));
  assert.ok(handler.includes('other.open = false'), 'other cards close directly');
  assert.ok(!handler.includes('waRenderStudio()'), 'closing never re-renders');
  assert.ok(handler.includes('waStudioOpen = card.dataset.waAccordion'), 'the open card is remembered');
});

test('textarea: the editor is a styled taller textarea, and hidden panels stay hidden', () => {
  assert.ok(studioSrc.includes('class="wa-template-text"'), 'classed textarea');
  assert.ok(studioSrc.includes('rows="6"'), 'six rows');
  assert.ok(!studioSrc.includes('rows="4"'), 'no four-row textarea remains');
  assert.ok(stylesSrc.includes('#waStudioCards textarea.wa-template-text{'), 'textarea rule exists');
  const ruleStart = stylesSrc.indexOf('#waStudioCards textarea.wa-template-text{');
  const rule = stylesSrc.slice(ruleStart, stylesSrc.indexOf('}', ruleStart));
  assert.ok(rule.includes('border:1px solid #dce6e1'), 'standard border');
  assert.ok(rule.includes('border-radius:9px'), 'standard radius');
  assert.ok(!stylesSrc.includes('#waStudioCards textarea.wa-template-text:focus'), 'no :focus rule — the global :focus-visible baseline (Plan 589) supplies the green ring, keeping the pinned 3px tally clean');
  assert.ok(stylesSrc.includes(':focus-visible {') && stylesSrc.includes('outline: 3px solid var(--green) !important'), 'global focus-visible baseline exists');
  assert.ok(stylesSrc.includes('.wa-tab-panel[hidden]{display:none!important}'), 'hidden panels stay hidden under .table-card display:grid');
});

test('drafts: saving clears both variant drafts and leaves other templates alone', () => {
  const drafts = {};
  captureWaStudioDraft(drafts, 'politeReminder', 'roman', 'roman edit');
  captureWaStudioDraft(drafts, 'politeReminder', 'urdu', 'urdu edit');
  captureWaStudioDraft(drafts, 'outageNotice', 'roman', 'other template edit');
  clearWaStudioDrafts(drafts, 'politeReminder');
  assert.equal(waStudioDraftBody(drafts, 'politeReminder', 'roman', 'saved'), 'saved');
  assert.equal(waStudioDraftBody(drafts, 'politeReminder', 'urdu', 'saved'), 'saved');
  assert.equal(waStudioDraftBody(drafts, 'outageNotice', 'roman', 'saved'), 'other template edit');
  assert.equal(waStudioDraftKey('politeReminder', 'urdu'), 'politeReminder:urdu');
  assert.equal(waStudioDraftKey('politeReminder', 'roman'), 'politeReminder:roman');
});

test('parity: EN + UR key counts are the new total', () => {
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR. The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,231 (was 5,229 via Reports Closing).
  // Re-pin (Bill card rebase 2026-11-23): parity 5,229 → 5,231 — L adds 2 keys, prof_hist_snapshot_footnote + prof_hist_due_on, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5231);
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5231);
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length);
});
