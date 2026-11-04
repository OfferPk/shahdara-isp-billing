// Plan 190 (Plan 101-202) — Shop Equipment Insurance and Asset Register.
//
// Shop equipment (furniture, tools, spares held at the shop) has no
// single register tying each item to its purchase detail and
// insurance cover, so a loss or claim starts with guesswork. This
// module is that register only: item, purchase date and cost as
// entered, location in the shop, insurance cover note, and insurer
// as entered.
//
// What this module is NOT, stated plainly:
//   - It is not an expense, claim, or stock movement. Recording an
//     asset never creates an expense, claim, or stock movement by
//     itself, and never changes any bill, payment, expense, or
//     stock total. The cost is kept exactly as the owner entered
//     it and is never parsed or totalled — no total field exists
//     anywhere in this module.
//   - It is not a disposal that erases history. Marking an asset
//     disposed only records the disposed state and date; the asset
//     stays in the register and is never removed or rewritten by
//     that mark.
//   - It is not a second stock register, tool log, or device
//     inventory. The stock register, tool logs, inventory audit,
//     business-device inventory, and any other existing module
//     are neither read nor written here.
//   - It is not insurance itself. The cover note and insurer are
//     only what the operator typed; this module makes no claim,
//     checks no policy, and sends nothing.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record
//     and the module never reads storage, the clock, or the
//     network, and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, expense,
//     stock, customer, claim, or sending field can ever creep
//     into a shop asset record.
//   - Duplicate ids are never rewritten, and there is no edit
//     function at all: an asset is recorded, marked disposed, or
//     removed — never silently rewritten.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= maxDay;
}

function normalizeShopAsset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const item = text(raw.item);
  const purchaseDate = text(raw.purchaseDate);
  if (!id || !item) return null;
  if (!isStrictDate(purchaseDate)) return null;
  const status = text(raw.status) === 'disposed' ? 'disposed' : 'active';
  const disposedDate = text(raw.disposedDate);
  if (disposedDate && !isStrictDate(disposedDate)) return null;
  return {
    id,
    item,
    purchaseDate,
    cost: text(raw.cost),
    location: text(raw.location),
    insurer: text(raw.insurer),
    coverNote: text(raw.coverNote),
    status,
    disposedDate: status === 'disposed' ? disposedDate : '',
  };
}

function normalizeShopAssetList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seenIds = new Set();
  for (const item of raw) {
    const asset = normalizeShopAsset(item);
    if (!asset) continue;
    if (seenIds.has(asset.id)) continue;
    seenIds.add(asset.id);
    out.push(asset);
  }
  return out;
}

function findShopAsset(list, id) {
  const assets = normalizeShopAssetList(list);
  return assets.find((asset) => asset.id === text(id)) || null;
}

function recordShopAsset(list, raw) {
  const assets = normalizeShopAssetList(list);
  const asset = normalizeShopAsset(raw);
  if (!asset) return assets;
  if (assets.some((entry) => entry.id === asset.id)) return assets;
  return [...assets, asset];
}

function removeShopAsset(list, id) {
  const assets = normalizeShopAssetList(list);
  return assets.filter((asset) => asset.id !== text(id));
}

function markShopAssetDisposed(list, id, disposedDate) {
  const assets = normalizeShopAssetList(list);
  const date = text(disposedDate);
  if (date && !isStrictDate(date)) return assets;
  return assets.map((asset) => {
    if (asset.id !== text(id)) return asset;
    if (asset.status === 'disposed') return asset;
    return { ...asset, status: 'disposed', disposedDate: date };
  });
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function shopAssetsSorted(list) {
  return normalizeShopAssetList(list).sort((a, b) => {
    const aLoc = lower(a.location);
    const bLoc = lower(b.location);
    if (!aLoc && bLoc) return 1;
    if (aLoc && !bLoc) return -1;
    return compareText(aLoc, bLoc) ||
      compareText(lower(a.item), lower(b.item)) ||
      compareText(a.id, b.id);
  });
}

function activeShopAssets(list) {
  return shopAssetsSorted(list).filter((asset) => asset.status === 'active');
}

function disposedShopAssets(list) {
  return shopAssetsSorted(list).filter((asset) => asset.status === 'disposed');
}

function shopAssetsInLocation(list, location) {
  const wanted = lower(location);
  if (!wanted) return shopAssetsSorted(list);
  return shopAssetsSorted(list).filter((asset) => lower(asset.location) === wanted);
}

function shopAssetLocations(list) {
  const seen = new Set();
  const out = [];
  for (const asset of shopAssetsSorted(list)) {
    const key = lower(asset.location);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(asset.location || 'No location given');
  }
  return out;
}

function shopAssetsByLocation(list) {
  return shopAssetLocations(list).map((location) => ({
    location,
    assets: shopAssetsSorted(list).filter((asset) =>
      (asset.location || 'No location given') === location),
  }));
}

function shopAssetCoverText(asset) {
  const entry = normalizeShopAsset(asset);
  if (!entry) return '';
  return entry.coverNote ? `cover: ${entry.coverNote}` : 'No insurance cover noted.';
}

function shopAssetText(asset) {
  const entry = normalizeShopAsset(asset);
  if (!entry) return '';
  const parts = [
    entry.item,
    `bought ${entry.purchaseDate}`,
  ];
  if (entry.cost) parts.push(`cost ${entry.cost}`);
  parts.push(entry.location ? `location ${entry.location}` : 'No location given');
  if (entry.insurer) parts.push(`insurer ${entry.insurer}`);
  parts.push(shopAssetCoverText(entry));
  if (entry.status === 'disposed') parts.push(entry.disposedDate ? `disposed ${entry.disposedDate}` : 'disposed');
  else parts.push('active');
  return parts.filter(Boolean).join(' — ');
}

function shopAssetSummaryText(list) {
  const assets = normalizeShopAssetList(list);
  const disposed = assets.filter((asset) => asset.status === 'disposed').length;
  const active = assets.length - disposed;
  const noCover = assets.filter((asset) => !asset.coverNote).length;
  return `${assets.length} shop asset${assets.length === 1 ? '' : 's'} recorded: ${active} active, ${disposed} disposed, ${noCover} with no insurance cover noted`;
}

function shopAssetHtml(asset) {
  const entry = normalizeShopAsset(asset);
  if (!entry) return '';
  return `<p><strong>${escapeHtml(entry.item)}</strong>; bought ${escapeHtml(entry.purchaseDate)}${entry.cost ? `; cost ${escapeHtml(entry.cost)}` : ''}; ${entry.location ? `location ${escapeHtml(entry.location)}` : 'No location given'}${entry.insurer ? `; insurer ${escapeHtml(entry.insurer)}` : ''}; ${escapeHtml(shopAssetCoverText(entry))}${entry.status === 'disposed' ? (entry.disposedDate ? `; disposed ${escapeHtml(entry.disposedDate)}` : '; disposed') : '; active'}.</p>`;
}

function shopAssetAllHtml(list) {
  return shopAssetsSorted(list).map((asset) => shopAssetHtml(asset)).join('');
}

function shopAssetCsv(list) {
  const rows = [['id', 'item', 'purchaseDate', 'cost', 'location', 'insurer', 'coverNote', 'status', 'disposedDate']];
  for (const asset of shopAssetsSorted(list)) {
    rows.push([asset.id, asset.item, asset.purchaseDate, asset.cost, asset.location, asset.insurer, asset.coverNote, asset.status, asset.disposedDate]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function shopAssetFilename() {
  return 'shop-assets.csv';
}

export {
  isStrictDate,
  normalizeShopAsset,
  normalizeShopAssetList,
  findShopAsset,
  recordShopAsset,
  removeShopAsset,
  markShopAssetDisposed,
  shopAssetsSorted,
  activeShopAssets,
  disposedShopAssets,
  shopAssetsInLocation,
  shopAssetsByLocation,
  shopAssetLocations,
  shopAssetCoverText,
  shopAssetText,
  shopAssetSummaryText,
  shopAssetHtml,
  shopAssetAllHtml,
  shopAssetCsv,
  shopAssetFilename,
};
