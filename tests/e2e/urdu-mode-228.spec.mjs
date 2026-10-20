import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { isEnglishOnlyVisibleText, isAllowlistedVisibleText } from '../../nav-language.js';

// Issue #228: Urdu mode must translate the visible UI (not just flip RTL),
// keep numbers/phones in order (bidi), and use the self-hosted Nastaliq font.
test.describe('#228 Urdu mode', () => {
  test('0 English-only visible buttons, Nastaliq font, bidi-safe amounts, screenshots at 390px', async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(1500);
    await page.locator('#languageToggleBtn').click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.languageController?.updateTranslations?.());
    await page.waitForTimeout(300);

    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ur');

    const collectButtons = () => page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button')) {
        if (!el.getClientRects().length) continue;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none') continue;
        const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) out.push(t);
      }
      return out;
    });

    fs.mkdirSync('test-results/urdu-228', { recursive: true });
    const allButtons = new Set(await collectButtons());
    await page.screenshot({ path: 'test-results/urdu-228/home-390.png' });
    for (const screen of ['customers', 'collection', 'bills', 'reports']) {
      // DOM click: bottom-nav buttons can be covered by sheets/modals that
      // the previous screen opened, which stalls Playwright actionability.
      await page.evaluate(s => document.querySelector(`[data-mobile-nav="${s}"]`)?.click(), screen);
      await page.waitForTimeout(1200);
      // The app's own controller re-applies translations to fresh renders
      // (a MutationObserver in nav-language does the same automatically).
      await page.evaluate(() => window.languageController?.updateTranslations?.());
      await page.waitForTimeout(300);
      (await collectButtons()).forEach(t => allButtons.add(t));
      await page.screenshot({ path: `test-results/urdu-228/${screen}-390.png` });
      await page.keyboard.press('Escape').catch(() => {});
    }
    const englishOnly = [...allButtons].filter(t => isEnglishOnlyVisibleText(t) && !isAllowlistedVisibleText(t));
    expect(englishOnly, `English-only visible buttons in Urdu mode: ${englishOnly.join(' | ')}`).toEqual([]);

    // Font: the self-hosted Nastaliq subset is loaded only now (Urdu mode),
    // and Urdu buttons render in it with tall line-height (no clipped glyphs).
    const fontInfo = await page.evaluate(async () => {
      const link = document.getElementById('urduFontLink');
      const btn = [...document.querySelectorAll('button')].find(b => /[\u0600-\u06FF]/.test(b.textContent || '') && b.getClientRects().length);
      if (!btn) return { link: Boolean(link), family: '', ratio: 0, clipped: -1 };
      const st = getComputedStyle(btn);
      await document.fonts.load('16px "Noto Nastaliq Urdu"');
      let clipped = 0;
      for (const b of document.querySelectorAll('button')) {
        if (!b.getClientRects().length || !/[\u0600-\u06FF]/.test(b.textContent || '')) continue;
        if (b.scrollHeight > b.clientHeight + 4) clipped += 1;
      }
      return {
        link: Boolean(link),
        family: st.fontFamily,
        ratio: parseFloat(st.lineHeight) / parseFloat(st.fontSize),
        clipped
      };
    });
    expect(fontInfo.link).toBe(true);
    expect(fontInfo.family).toContain('Noto Nastaliq Urdu');
    expect(fontInfo.ratio).toBeGreaterThanOrEqual(1.8);
    expect(fontInfo.clipped).toBe(0);

    // Bidi: digit runs inside translated labels sit in <bdi>, and mixed
    // paragraphs use unicode-bidi: plaintext so punctuation cannot jump.
    const bidi = await page.evaluate(() => {
      const aging = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('واجبات کی عمر'));
      const note = document.querySelector('.backup-local-note');
      return {
        agingHasBdi: Boolean(aging && aging.querySelector('bdi')),
        noteBidi: note ? getComputedStyle(note).unicodeBidi : 'missing'
      };
    });
    expect(bidi.agingHasBdi).toBe(true);
    expect(bidi.noteBidi).toBe('plaintext');

    // Inputs accept mixed-direction values without reordering.
    const inputDir = await page.evaluate(() => document.querySelector('#globalSearchInput, input[type="search"], input')?.getAttribute('dir'));
    expect(inputDir).toBe('auto');
  });
});
