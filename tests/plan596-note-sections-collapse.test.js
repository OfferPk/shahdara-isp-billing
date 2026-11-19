// Plan 596 — Empty profile note sections collapse to one line each.
//
// The five profile note sections (handling note, standing instruction,
// spoken language, gate access, emergency contact) used to render heading
// + long explainer + a full open form when the customer had no note.
// They now render heading + none line + a closed <details
// class="profile-accordion"> whose summary is the shared Add label;
// explainer + form live inside. With a note the rendering is unchanged
// (explainer + note line + form, no details). The shared key is
// prof_note_add ('Add {heading}'), so parity moves to the new total —
// spelled out in words in this file's comments, never as digits, because
// 591's G5a sweep fails the suite on any test file containing the
// previous total's digits.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS, t } from '../nav-language.js';
import { handlingNoteSectionHtml } from '../handling-note.js';
import { standingInstructionSectionHtml } from '../standing-instruction-note.js';
import { spokenLanguageNoteSectionHtml } from '../spoken-language-note.js';
import { gateAccessInstructionSectionHtml } from '../gate-access-instruction.js';
import { customerEmergencyContactSectionHtml } from '../customer-emergency-contact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const customer = { id: 'cust-1', name: 'Test Customer' };

// Labels exactly as app.js builds them (t() calls, EN).
function labelsFor(headingKey, noneKey) {
  return {
    heading: t(headingKey),
    none: t(noneKey),
    add: t('prof_note_add', null, { heading: t(headingKey) }),
    save: t('save'),
  };
}

function assertCollapsed(html, { summary, noneText, formId, explainerSnippet }) {
  assert.ok(html.includes('<h4>'), 'heading renders');
  assert.ok(html.includes(`<summary>${summary}</summary>`), `summary reads "${summary}"`);
  assert.ok(html.includes('<details class="profile-accordion">'), 'closed accordion, no open attribute');
  assert.ok(!html.includes('<details class="profile-accordion" open'), 'accordion is closed');
  assert.ok(html.indexOf(noneText) !== -1 && html.indexOf(noneText) < html.indexOf('<details'), 'none line stays visible outside the accordion');
  assert.ok(html.indexOf(explainerSnippet) > html.indexOf('<details'), 'explainer is inside the accordion');
  assert.ok(html.includes(`id="${formId}"`), 'form renders');
  assert.ok(html.indexOf(`id="${formId}"`) > html.indexOf('<details'), 'form is inside the accordion');
  assert.ok(html.indexOf('</form>') < html.indexOf('</details>'), 'form closes before the accordion closes');
  assert.ok(!html.includes('Remove'), 'no Remove button without a note');
}

function assertFull(html, { explainerSnippet, currentClass }) {
  assert.ok(!html.includes('<details'), 'no accordion when a note exists');
  assert.ok(html.includes(explainerSnippet), 'explainer still renders');
  assert.ok(html.includes(`class="${currentClass}"`), 'note line still renders');
  assert.ok(html.includes('Remove'), 'Remove button still renders');
}

describe('Plan 596: empty profile note sections collapse', () => {
  test('G1 handling note with no note collapses: heading + none line + Add summary, explainer + form inside', () => {
    const html = handlingNoteSectionHtml(customer, [], labelsFor('prof_handling_heading', 'prof_handling_none'));
    assertCollapsed(html, {
      summary: 'Add Handling note',
      noneText: 'No handling note for this customer.',
      formId: 'chnForm',
      explainerSnippet: 'read before the money moves',
    });
  });

  test('G2 handling note with a note renders exactly as before: no details, explainer + note line + form', () => {
    const html = handlingNoteSectionHtml(customer, [{ id: 'note-1', customerId: 'cust-1', text: 'Knock twice, then wait', updatedBy: 'Saad', updatedDate: '2026-11-10' }], labelsFor('prof_handling_heading', 'prof_handling_none'));
    assertFull(html, { explainerSnippet: 'read before the money moves', currentClass: 'chn-current' });
    assert.ok(html.includes('Knock twice, then wait'), 'the note text renders');
  });

  test('G3 standing instruction with no note collapses, its five inputs inside the accordion', () => {
    const html = standingInstructionSectionHtml(customer, [], labelsFor('prof_sin_heading', 'prof_sin_none'));
    assertCollapsed(html, {
      summary: 'Add Standing instruction',
      noneText: 'No standing instruction for this customer.',
      formId: 'sinForm',
      explainerSnippet: 'noticed in days, not in months',
    });
    for (const id of ['sinAmount', 'sinDay', 'sinMethod', 'sinBy', 'sinDate']) {
      assert.ok(html.indexOf(`id="${id}"`) > html.indexOf('<details'), `${id} is inside the accordion`);
    }
  });

  test('G4 standing instruction with a note renders exactly as before', () => {
    const html = standingInstructionSectionHtml(customer, [{ id: 'note-1', customerId: 'cust-1', amountCents: 200000, dayOfMonth: 5, method: 'Cash', recordedBy: 'Saad', recordedDate: '2026-11-10' }], labelsFor('prof_sin_heading', 'prof_sin_none'));
    assertFull(html, { explainerSnippet: 'noticed in days, not in months', currentClass: 'sin-current' });
  });

  test('G5 spoken language with no note collapses: heading + none line + Add summary', () => {
    const html = spokenLanguageNoteSectionHtml(customer, [], labelsFor('prof_spoken_lang_heading', 'prof_spoken_lang_none'));
    assertCollapsed(html, {
      summary: 'Add Spoken language',
      noneText: 'No spoken language noted for this customer.',
      formId: 'slnForm',
      explainerSnippet: 'builds the trust the whole business runs on',
    });
  });

  test('G6 spoken language with a note renders exactly as before', () => {
    const html = spokenLanguageNoteSectionHtml(customer, [{ id: 'note-1', customerId: 'cust-1', language: 'Punjabi', notedBy: 'Saad', notedDate: '2026-11-10' }], labelsFor('prof_spoken_lang_heading', 'prof_spoken_lang_none'));
    assertFull(html, { explainerSnippet: 'builds the trust the whole business runs on', currentClass: 'sln-current' });
    assert.ok(html.includes('Punjabi'), 'the language renders');
  });

  test('G7 gate access with no note collapses: heading + none line + Add summary', () => {
    const html = gateAccessInstructionSectionHtml(customer, [], labelsFor('prof_gate_access_heading', 'prof_gate_access_none'));
    assertCollapsed(html, {
      summary: 'Add Gate and access',
      noneText: 'No gate access instruction noted for this customer.',
      formId: 'gaiForm',
      explainerSnippet: 'ending at a locked gate',
    });
  });

  test('G8 gate access with a note renders exactly as before', () => {
    const html = gateAccessInstructionSectionHtml(customer, [{ id: 'note-1', customerId: 'cust-1', instruction: 'Call before coming', notedBy: 'Saad', notedDate: '2026-11-10' }], labelsFor('prof_gate_access_heading', 'prof_gate_access_none'));
    assertFull(html, { explainerSnippet: 'ending at a locked gate', currentClass: 'gai-current' });
    assert.ok(html.includes('Call before coming'), 'the instruction renders');
  });

  test('G9 emergency contact with no contact collapses, its phone input inside the accordion', () => {
    const html = customerEmergencyContactSectionHtml(customer, [], labelsFor('prof_emc_heading', 'prof_emc_none'));
    assertCollapsed(html, {
      summary: 'Add Emergency contact',
      noneText: 'No emergency contact noted for this customer.',
      formId: 'emcForm',
      explainerSnippet: 'leaving the collection for another day',
    });
    assert.ok(html.indexOf('id="emcPhone"') > html.indexOf('<details'), 'phone input is inside the accordion');
  });

  test('G10 emergency contact with a contact renders exactly as before', () => {
    const html = customerEmergencyContactSectionHtml(customer, [{ id: 'note-1', customerId: 'cust-1', name: 'Test Person', relationship: 'Brother', phone: '03012345678' }], labelsFor('prof_emc_heading', 'prof_emc_none'));
    assertFull(html, { explainerSnippet: 'leaving the collection for another day', currentClass: 'emc-current' });
    assert.ok(html.includes('03012345678'), 'the phone renders');
  });

  test('G11 each empty section has exactly one accordion and its own form id — opening one cannot open another', () => {
    const htmls = [
      handlingNoteSectionHtml(customer, [], labelsFor('prof_handling_heading', 'prof_handling_none')),
      standingInstructionSectionHtml(customer, [], labelsFor('prof_sin_heading', 'prof_sin_none')),
      spokenLanguageNoteSectionHtml(customer, [], labelsFor('prof_spoken_lang_heading', 'prof_spoken_lang_none')),
      gateAccessInstructionSectionHtml(customer, [], labelsFor('prof_gate_access_heading', 'prof_gate_access_none')),
      customerEmergencyContactSectionHtml(customer, [], labelsFor('prof_emc_heading', 'prof_emc_none')),
    ];
    const formIds = ['chnForm', 'sinForm', 'slnForm', 'gaiForm', 'emcForm'];
    htmls.forEach((html, i) => {
      assert.equal((html.match(/<details/g) || []).length, 1, `section ${i} has exactly one accordion`);
      assert.ok(html.includes(`id="${formIds[i]}"`), `section ${i} carries its own form`);
      for (const other of formIds.filter((f) => f !== formIds[i])) {
        assert.ok(!html.includes(`id="${other}"`), `section ${i} does not carry ${other}`);
      }
    });
  });

  test('G12 one shared key prof_note_add interpolates the heading in both languages; no per-section add key exists', () => {
    assert.equal(TRANSLATIONS.en.prof_note_add, 'Add {heading}');
    assert.equal(TRANSLATIONS.ur.prof_note_add, '{heading} شامل کریں');
    assert.equal(t('prof_note_add', null, { heading: t('prof_handling_heading') }), 'Add Handling note');
    assert.equal(t('prof_note_add', 'ur', { heading: t('prof_handling_heading', 'ur') }), 'خاص ہدایت شامل کریں');
    // No per-section note key exists: the five sections share prof_note_add.
    // (prof_incident_add is a different feature's own key, untouched.)
    for (const key of ['prof_handling_add', 'prof_sin_add', 'prof_spoken_lang_add', 'prof_gate_access_add', 'prof_emc_add']) {
      assert.ok(!(key in TRANSLATIONS.en), `${key} must not exist — the sections share prof_note_add`);
      assert.ok(!(key in TRANSLATIONS.ur), `${key} must not exist in UR either`);
    }
  });

  test('G13 parity moves to the new total in both languages', () => {
    assert.equal(Object.keys(TRANSLATIONS.en).length, 4767, 'EN parity 4,767');
    assert.equal(Object.keys(TRANSLATIONS.ur).length, 4767, 'UR parity 4,767');
  });

  test('G14 this file pins the new total and stays free of the previous total digits', () => {
    const selfSrc = read('tests/plan596-note-sections-collapse.test.js');
    assert.ok(selfSrc.includes('4767'), 'this file pins the new total');
    // The previous total's digits are built, never spelled, so this guard
    // cannot trip the sweep it guards.
    assert.ok(!selfSrc.includes('47' + '66'), 'this file must stay free of the previous-count literal');
    assert.ok(!selfSrc.includes('47' + '22'), 'this file must stay free of the older-count literal');
  });

  test('G15 styles split: the five sections target the accordion body, other sections keep the old form', () => {
    const css = read('styles.css');
    for (const section of ['profile-handling-note', 'profile-standing-instruction', 'profile-spoken-language-note', 'profile-gate-access-instruction', 'profile-customer-emergency-contact']) {
      assert.ok(css.includes(`.${section} .profile-accordion-body > p:first-of-type`), `${section} explainer rule moved inside the accordion body`);
      assert.ok(!css.includes(`.${section} > p:first-of-type`), `${section} no longer matches the old top-level form`);
    }
    assert.ok(css.includes('.profile-field-change-history > p:first-of-type'), 'unaffected sections keep the old form');
  });

  test('G16 no new accordion is ever open by default', () => {
    const htmls = [
      handlingNoteSectionHtml(customer, [], labelsFor('prof_handling_heading', 'prof_handling_none')),
      standingInstructionSectionHtml(customer, [], labelsFor('prof_sin_heading', 'prof_sin_none')),
      spokenLanguageNoteSectionHtml(customer, [], labelsFor('prof_spoken_lang_heading', 'prof_spoken_lang_none')),
      gateAccessInstructionSectionHtml(customer, [], labelsFor('prof_gate_access_heading', 'prof_gate_access_none')),
      customerEmergencyContactSectionHtml(customer, [], labelsFor('prof_emc_heading', 'prof_emc_none')),
    ];
    for (const html of htmls) {
      assert.ok(!html.includes(' open'), 'no open attribute on any accordion');
    }
  });

  test('G17 the five empty sections together show no explainer and no form outside their accordions', () => {
    const htmls = [
      handlingNoteSectionHtml(customer, [], labelsFor('prof_handling_heading', 'prof_handling_none')),
      standingInstructionSectionHtml(customer, [], labelsFor('prof_sin_heading', 'prof_sin_none')),
      spokenLanguageNoteSectionHtml(customer, [], labelsFor('prof_spoken_lang_heading', 'prof_spoken_lang_none')),
      gateAccessInstructionSectionHtml(customer, [], labelsFor('prof_gate_access_heading', 'prof_gate_access_none')),
      customerEmergencyContactSectionHtml(customer, [], labelsFor('prof_emc_heading', 'prof_emc_none')),
    ];
    for (const html of htmls) {
      const before = html.slice(0, html.indexOf('<details'));
      assert.ok(!before.includes('<form'), 'no form before the accordion opens');
      assert.ok(!before.includes('<textarea') && !before.includes('<input'), 'no field before the accordion opens');
    }
  });

  test('G18 app.js passes the shared Add label at all five call sites', () => {
    const appJs = read('app.js');
    const sites = (appJs.match(/add: t\('prof_note_add'/g) || []).length;
    assert.equal(sites, 5, 'exactly five add: label lines, one per section');
    for (const heading of ['prof_handling_heading', 'prof_sin_heading', 'prof_spoken_lang_heading', 'prof_gate_access_heading', 'prof_emc_heading']) {
      assert.ok(appJs.includes(`{ heading: t('${heading}') }`), `${heading} is interpolated into the shared key`);
    }
  });

  test('G19 the five Save buttons are untouched — Plan 612 owns renaming them', () => {
    for (const mod of ['handling-note.js', 'standing-instruction-note.js', 'spoken-language-note.js', 'gate-access-instruction.js', 'customer-emergency-contact.js']) {
      const src = read(mod);
      assert.ok(src.includes('labels.save'), `${mod} still passes the shared Save label through`);
    }
    const saveLabel = t('save');
    const html = handlingNoteSectionHtml(customer, [], labelsFor('prof_handling_heading', 'prof_handling_none'));
    assert.ok(html.includes(`>${saveLabel}<`), 'the Save button still renders the shared label');
  });
});
