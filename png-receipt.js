// SISP-6: Visual PNG Image Receipt & Urdu "PAID / وصول پایا" Digital Stamp.
// A bank-slip style receipt image (800x1000 CSS pt, rendered HiDPI 2x =
// 1600x2000 px) generated on an HTML5 canvas, shareable to WhatsApp via
// navigator.share or downloadable as a PNG file.
//
// Structure (testability in Node, where no browser canvas exists):
// - buildPngReceiptModel(): pure — receipt object + customer -> slip model.
//   Reuses the EXISTING receipt data paths: buildPaymentReceipt output,
//   its SISP-2 arrearsBreakdown and its SISP-4 kist lines. No parallel
//   computation, no new billing logic.
// - computePngReceiptLayout(): pure — model -> draw commands (rect/text/
//   line/seal). Tests assert size, seal, rows and bounds without a canvas.
// - renderPngReceipt(): executes draw commands on any 2D context (real or
//   stubbed), using only a minimal canvas interface.
// - generateReceiptPNG(): browser entry point — real canvas -> { blob,
//   dataUrl, width, height, filename }.
// - shareOrDownloadPng(): 1-tap share via navigator.canShare({ files })
//   with a 1-click download fallback.
//
// The PNG itself is a white paper slip BY DESIGN (like a bank/EasyPaisa
// slip) — that is not a dark-mode violation. All on-screen UI around it
// (buttons, dialogs) uses theme tokens.
import { kistLineLabel } from './installment-plan.js';
import { displayCustomerName } from './urdu-names.js';

export const PNG_RECEIPT_WIDTH = 1600; // 800 CSS pt @ HiDPI 2x
export const PNG_RECEIPT_HEIGHT = 2000; // 1000 CSS pt @ HiDPI 2x
export const PNG_RECEIPT_MIME = 'image/png';

const PAPER = '#ffffff';
const INK = '#14201c';
const MUTED = '#5a6b64';
const ACCENT = '#0e7a5f';
const BOX_BG = '#f4f7f5';
const HAIRLINE = '#d8dee0';
const SEAL_GREEN = '#1a7a3c';
const SEAL_AMBER = '#b7791f';
const FONT_LATIN = 'system-ui, sans-serif';
const FONT_URDU = `'Noto Nastaliq Urdu', 'Noto Naskh Arabic', system-ui, sans-serif`;

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const money = (value) => {
  const num = Number(value);
  return `PKR ${Number.isFinite(num) ? num.toLocaleString() : 0}`;
};
const sanitizeFilePart = (value) =>
  text(value).replace(/[^A-Za-z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

/**
 * Seal decision (spec: green PAID stamp when the balance is cleared,
 * amber PARTIAL PAID when a balance remains). A receipt whose balance is
 * unknown (balanceDueCents null) NEVER claims PAID — it stamps PARTIAL.
 */
export function decideSeal(receipt) {
  const cleared = receipt?.balanceDueCents === 0;
  return cleared
    ? { kind: 'PAID', label: 'PAID', urdu: 'وصول پایا', sub: 'Shahdara ISP', color: SEAL_GREEN }
    : { kind: 'PARTIAL', label: 'PARTIAL PAID', urdu: '', sub: 'Shahdara ISP', color: SEAL_AMBER };
}

export function pngReceiptFilename(modelOrReceipt) {
  const num = sanitizeFilePart(modelOrReceipt?.receiptNumber) || 'receipt';
  return `SIP-receipt-${num}.png`;
}

/**
 * Pure model builder. `receipt` is a buildPaymentReceipt() output;
 * `customer` supplies mohalla/zone + the Urdu name (via urdu-names.js).
 * Nothing here recomputes billing: every amount comes from the receipt.
 */
export function buildPngReceiptModel(receipt, customer, options = {}) {
  if (!receipt || typeof receipt !== 'object') throw new Error('A payment receipt is required.');
  const breakdown = receipt.arrearsBreakdown ?? null;
  const romanName = text(receipt.customerName) || text(customer?.name);
  const urduName = displayCustomerName(customer ?? {}, 'ur');
  const areaZone = [text(customer?.mohalla), text(customer?.zone)].filter(Boolean).join(', ');
  const method = text(receipt.paymentMethod)
    + (text(receipt.transactionId) ? ` (Txn: ${text(receipt.transactionId)})` : '');

  const financial = [];
  if (breakdown) {
    financial.push({ label: 'Previous Balance / Sabiqa Baqaya', value: money(breakdown.previousArrears) });
  }
  financial.push({
    label: 'Current Month Bill / Mahana Package',
    value: money(breakdown ? breakdown.packageAmount : receipt.nominalPrice),
  });
  if (breakdown?.kistAmount > 0) {
    financial.push({ label: 'Hardware / Kist', value: money(breakdown.kistAmount) });
    for (const line of Array.isArray(breakdown.kistLines) ? breakdown.kistLines : []) {
      financial.push({ label: kistLineLabel(line), value: money(line.amount), indent: true });
    }
  }
  if (receipt.lateFee > 0) financial.push({ label: 'Late Fee Surcharge', value: `+${money(receipt.lateFee)}` });
  if (receipt.discount > 0) financial.push({ label: 'Discount / رعایت', value: `-${money(receipt.discount)}` });
  // SISP-30: the concession line, and the remaining balance is net of it —
  // the SISP-2 breakdown itself stays gross, so subtract here for display.
  if (receipt.concessionAmount > 0) financial.push({ label: 'Outage Concession / رعایت', value: `-${money(receipt.concessionAmount)}` });
  // SISP-40: the hamsaya referral credit line, next to the concession.
  if (receipt.referralCreditAmount > 0) financial.push({ label: 'Referral Credit / ہمسایہ ریفرل', value: `-${money(receipt.referralCreditAmount)}` });
  // SISP-43: billed ticket charges this payment settled, one line each.
  for (const line of Array.isArray(receipt.ticketCharges) ? receipt.ticketCharges : []) {
    financial.push({ label: `Murammat / Material Charge (${line.ticketId})`, value: money(line.amount) });
  }
  financial.push({ label: 'Amount Paid / Wusool Paya', value: money(receipt.paidAmount), strong: true });
  financial.push({ label: 'Payment Method / طریقہ', value: method || '—' });
  const grossRemaining = breakdown
    ? breakdown.balanceDue
    : (receipt.balanceDueCents === null || receipt.balanceDueCents === undefined
      ? null : receipt.balanceDueCents / 100);
  const remaining = grossRemaining === null ? null : Math.max(0, grossRemaining - (receipt.concessionAmount > 0 && breakdown ? receipt.concessionAmount : 0) - (receipt.referralCreditAmount > 0 && breakdown ? receipt.referralCreditAmount : 0));
  financial.push({
    label: 'Remaining Balance / Baqi Rehta',
    value: remaining === null ? '—' : money(remaining),
    strong: true,
  });

  return {
    width: PNG_RECEIPT_WIDTH,
    height: PNG_RECEIPT_HEIGHT,
    businessName: text(options.businessName) || 'Shahdara ISP',
    businessPhone: text(options.businessPhone) || '0300-1234567',
    areaName: text(options.areaName) || 'Shahdara',
    receiptNumber: text(receipt.receiptNumber),
    paymentDate: text(receipt.paymentDate),
    month: text(receipt.servicePeriodStart)?.slice(0, 7) || '',
    customerName: romanName,
    urduName: urduName && urduName !== romanName ? urduName : '',
    connectionId: text(receipt.customerId),
    areaZone: areaZone || 'Not recorded',
    packageLine: [text(receipt.package), receipt.speedMbps ? `${receipt.speedMbps} Mbps` : '']
      .filter(Boolean).join(' '),
    financial,
    seal: decideSeal(receipt),
    status: text(receipt.status) || 'RECEIVED',
    urduNote: text(receipt.urduNote),
    issuedAt: text(options.issuedAt) || new Date().toISOString(),
  };
}

function wrapText(ctx, value, maxWidth) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    const width = ctx.measureText ? ctx.measureText(trial).width : trial.length * 20;
    if (width > maxWidth && current) { lines.push(current); current = word; }
    else current = trial;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/**
 * Pure layout: returns { width, height, commands, footerY }. Commands:
 * rect {x,y,w,h,fill,stroke?}, text {text,x,y,font,align,fill,direction?},
 * line {x1,y1,x2,y2,stroke,width}, seal {cx,cy,r,label,urdu,sub,color}.
 * Every command stays inside the 1600x2000 canvas for typical receipts.
 */
export function computePngReceiptLayout(model, measureFn) {
  const measure = typeof measureFn === 'function'
    ? measureFn
    : (t) => t.length * 24;
  const W = PNG_RECEIPT_WIDTH;
  const H = PNG_RECEIPT_HEIGHT;
  const M = 80; // margin
  const contentW = W - M * 2;
  const commands = [];
  const rect = (x, y, w, h, fill, stroke) => commands.push({ type: 'rect', x, y, w, h, fill, stroke });
  const txt = (textValue, x, y, font, align, fill, direction) =>
    commands.push({ type: 'text', text: textValue, x, y, font, align, fill, direction });
  const line = (x1, y1, x2, y2, stroke, width) =>
    commands.push({ type: 'line', x1, y1, x2, y2, stroke, width });

  let y = 0;
  rect(0, y, W, 24, ACCENT);
  y = 130;
  txt(model.businessName.toUpperCase(), W / 2, y, `700 58px ${FONT_LATIN}`, 'center', INK);
  y += 76;
  txt('Payment Receipt / رسید ادائیگی', W / 2, y, `600 46px ${FONT_LATIN}`, 'center', ACCENT);
  y += 66;
  txt(`Receipt #: ${model.receiptNumber || '—'}`, W / 2, y, `500 40px ${FONT_LATIN}`, 'center', MUTED);
  y += 58;
  txt(`Date: ${model.paymentDate || '—'}${model.month ? `  ·  Month: ${model.month}` : ''}`,
    W / 2, y, `500 40px ${FONT_LATIN}`, 'center', MUTED);
  y += 52;
  line(M, y, W - M, y, HAIRLINE, 2);
  y += 48;

  // Subscriber box.
  const subRows = [
    { label: 'Customer / صارف', value: model.customerName || '—', font: `700 50px ${FONT_LATIN}` },
    ...(model.urduName
      ? [{ label: '', value: model.urduName, font: `500 58px ${FONT_URDU}`, direction: 'rtl' }]
      : []),
    { label: 'Connection ID / کھاتہ', value: model.connectionId ? `#${model.connectionId}` : '—', font: `500 44px ${FONT_LATIN}` },
    { label: 'Area / Zone', value: model.areaZone, font: `500 44px ${FONT_LATIN}` },
    { label: 'Package / پیکیج', value: model.packageLine || '—', font: `500 44px ${FONT_LATIN}` },
  ];
  const subPitch = 78;
  const subH = 56 + subRows.length * subPitch + 20;
  const subY = y;
  rect(M, subY, contentW, subH, BOX_BG, HAIRLINE);
  let ry = subY + 56;
  for (const row of subRows) {
    if (row.label) txt(row.label, M + 44, ry + 8, `500 34px ${FONT_LATIN}`, 'left', MUTED);
    txt(row.value, row.label ? M + 44 : W / 2, ry + 52, row.font,
      row.label ? 'left' : 'center', INK, row.direction);
    ry += subPitch;
  }
  y = subY + subH + 44;

  // Financial box.
  const finPitch = 74;
  const finH = 56 + model.financial.length * finPitch + 20;
  const finY = y;
  rect(M, finY, contentW, finH, PAPER, HAIRLINE);
  txt('Amount Details / رقم کی تفصیل', M + 44, finY + 52, `700 40px ${FONT_LATIN}`, 'left', INK);
  let fy = finY + 56;
  for (const row of model.financial) {
    const x = M + 44 + (row.indent ? 56 : 0);
    txt(row.label, x, fy + 52, `${row.strong ? '700' : '500'} 42px ${FONT_LATIN}`, 'left', row.strong ? INK : MUTED);
    txt(row.value, W - M - 44, fy + 52, `${row.strong ? '700' : '500'} 46px ${FONT_LATIN}`, 'right', INK);
    fy += finPitch;
    if (row !== model.financial.at(-1)) line(M + 44, fy - 8, W - M - 44, fy - 8, HAIRLINE, 1);
  }
  y = finY + finH;

  // Official seal: overlaps the financial box's bottom-right corner, like
  // a real rubber stamp. Angled, double ring, green PAID / amber PARTIAL.
  const sealR = 168;
  const sealCx = W - M - 260;
  const sealCy = y - 30;
  commands.push({
    type: 'seal', cx: sealCx, cy: sealCy, r: sealR,
    label: model.seal.label, urdu: model.seal.urdu, sub: model.seal.sub, color: model.seal.color,
  });
  y += 210;

  // Footer: Urdu note (wrapped, centered) + issued line.
  const noteLines = model.urduNote ? wrapText({ measureText: (t) => ({ width: measure(t) }) }, model.urduNote, contentW - 160) : [];
  for (const noteLine of noteLines) {
    txt(noteLine, W / 2, y, `500 42px ${FONT_URDU}`, 'center', MUTED, 'rtl');
    y += 62;
  }
  y += 10;
  txt(`Issued: ${model.issuedAt.slice(0, 16).replace('T', ' ')}  ·  Thank you! Shahdara ISP`,
    W / 2, y, `500 34px ${FONT_LATIN}`, 'center', MUTED);
  y += 60;

  return { width: W, height: H, commands, footerY: y };
}

/** Execute layout commands on any 2D context (real or stubbed). */
export function renderPngReceipt(ctx, layout) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, layout.width, layout.height);
  for (const cmd of layout.commands) {
    if (cmd.type === 'rect') {
      if (cmd.fill) { ctx.fillStyle = cmd.fill; ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h); }
      if (cmd.stroke) {
        ctx.strokeStyle = cmd.stroke; ctx.lineWidth = 2;
        ctx.strokeRect(cmd.x, cmd.y, cmd.w, cmd.h);
      }
    } else if (cmd.type === 'line') {
      ctx.strokeStyle = cmd.stroke; ctx.lineWidth = cmd.width;
      ctx.beginPath(); ctx.moveTo(cmd.x1, cmd.y1); ctx.lineTo(cmd.x2, cmd.y2); ctx.stroke();
    } else if (cmd.type === 'text') {
      ctx.font = cmd.font; ctx.fillStyle = cmd.fill;
      ctx.textAlign = cmd.align || 'left'; ctx.textBaseline = 'alphabetic';
      if (cmd.direction) ctx.direction = cmd.direction;
      ctx.fillText(cmd.text, cmd.x, cmd.y);
      if (cmd.direction) ctx.direction = 'inherit';
    } else if (cmd.type === 'seal') {
      ctx.save();
      ctx.translate(cmd.cx, cmd.cy);
      ctx.rotate(-0.21);
      ctx.strokeStyle = cmd.color; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, 0, cmd.r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, cmd.r - 22, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = cmd.color; ctx.textAlign = 'center';
      ctx.font = `800 52px ${FONT_LATIN}`;
      ctx.fillText(cmd.label, 0, cmd.urdu ? -18 : 18);
      if (cmd.urdu) {
        ctx.font = `600 56px ${FONT_URDU}`;
        ctx.direction = 'rtl';
        ctx.fillText(cmd.urdu, 0, 52);
        ctx.direction = 'inherit';
      }
      ctx.font = `500 34px ${FONT_LATIN}`;
      ctx.fillText(cmd.sub, 0, cmd.urdu ? 104 : 72);
      ctx.restore();
    }
  }
}

function defaultCreateCanvas(width, height) {
  if (typeof document === 'undefined') {
    throw new Error('No document canvas available; pass options.createCanvas.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Browser entry point. Returns { model, layout, canvas, blob, dataUrl,
 * width, height, mime, filename }. Test criterion: a valid image/png
 * DataURL/Blob with non-zero dimensions rendering accurate details.
 */
export async function generateReceiptPNG(receipt, customer, options = {}) {
  const model = buildPngReceiptModel(receipt, customer, options);
  // Best-effort: let the Nastaliq webfont finish loading so Urdu glyphs
  // render with the real font instead of a fallback. Never blocks long.
  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await Promise.race([document.fonts.ready, sleep(1200)]);
    }
  } catch { /* font wait is best-effort only */ }
  const createCanvas = options.createCanvas || defaultCreateCanvas;
  const canvas = createCanvas(model.width, model.height);
  canvas.width = model.width;
  canvas.height = model.height;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  // Wrap the footer note with the real canvas metrics when available.
  const layout = ctx.measureText
    ? computePngReceiptLayout(model, (t) => ctx.measureText(t).width)
    : computePngReceiptLayout(model);
  renderPngReceipt(ctx, layout);
  const dataUrl = typeof canvas.toDataURL === 'function' ? canvas.toDataURL(PNG_RECEIPT_MIME) : '';
  let blob = null;
  if (typeof canvas.toBlob === 'function') {
    blob = await new Promise((resolve) => {
      try { canvas.toBlob((b) => resolve(b || null), PNG_RECEIPT_MIME); }
      catch { resolve(null); }
    });
  }
  return {
    model, layout, canvas, blob, dataUrl,
    width: model.width, height: model.height,
    mime: PNG_RECEIPT_MIME, filename: pngReceiptFilename(model),
  };
}

/**
 * 1-tap share: navigator.share with the PNG file when the platform
 * supports it (mobile/Capacitor -> WhatsApp target chooser), otherwise a
 * 1-click download fallback. Returns 'shared' or 'downloaded'. `refs`
 * injects navigator/document for tests; defaults to the real globals.
 */
export async function shareOrDownloadPng(png, refs = {}) {
  const nav = refs.navigator ?? (typeof navigator !== 'undefined' ? navigator : null);
  const doc = refs.document ?? (typeof document !== 'undefined' ? document : null);
  const filename = png.filename || 'receipt.png';
  if (png.blob && nav?.canShare && nav.share) {
    try {
      const FileCtor = refs.File ?? (typeof File !== 'undefined' ? File : null);
      if (FileCtor) {
        const file = new FileCtor([png.blob], filename, { type: PNG_RECEIPT_MIME });
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file] });
          return 'shared';
        }
      }
    } catch { /* fall through to download */ }
  }
  if (!doc) throw new Error('Download is not available here.');
  const url = png.dataUrl || '';
  if (!url) throw new Error('No PNG data available to download.');
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  if (doc.body?.appendChild) {
    doc.body.appendChild(anchor);
    anchor.click();
    doc.body.removeChild(anchor);
  } else {
    anchor.click();
  }
  return 'downloaded';
}
