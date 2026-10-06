export const BILL_PACKAGES = Object.freeze([
  Object.freeze({ id:'3mbps-100gb', label:'3Mbps / 100GB', price:1000, speedMbps:3, dataLimit:'100 GB' }),
  Object.freeze({ id:'3mbps-300gb', label:'3Mbps / 300GB', price:1600, speedMbps:3, dataLimit:'300 GB' }),
  Object.freeze({ id:'5mbps-150gb', label:'5Mbps / 150GB', price:1500, speedMbps:5, dataLimit:'150 GB' }),
  Object.freeze({ id:'5mbps-500gb', label:'5Mbps / 500GB', price:2500, speedMbps:5, dataLimit:'500 GB' }),
  Object.freeze({ id:'5mbps-200gb', label:'5Mbps / 200GB', price:2000, speedMbps:5, dataLimit:'200 GB' }),
  Object.freeze({ id:'15mbps-unlimited', label:'15Mbps Unlimited', price:3000, speedMbps:15, dataLimit:'' })
]);

export function billPackageById(id) {
  return BILL_PACKAGES.find(plan => plan.id === id) ?? null;
}

export function billPackageByLabel(label) {
  const normalized = String(label ?? '').normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase();
  if (!normalized) return null;
  return BILL_PACKAGES.find(plan => plan.label.normalize('NFKC').replace(/\s+/g, '').toLocaleLowerCase() === normalized) ?? null;
}

export function classifyPackagePrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return amount < 3000 ? 'Limited' : 'Unlimited';
}

export function dataLimitFromPackageLabel(label) {
  const preset = billPackageByLabel(label);
  if (preset) return preset.dataLimit;
  const match = String(label ?? '').match(/\b(\d+(?:\.\d+)?)\s*(GB|GiB|TB|TiB)\b/i);
  return match ? `${match[1]} ${match[2].toUpperCase()}` : '';
}

export function createBillPackageSnapshot(id) {
  const plan = billPackageById(id);
  if (!plan) return null;
  return {
    packageId:plan.id,
    label:plan.label,
    nominalPrice:plan.price,
    speedMbps:plan.speedMbps,
    packageType:classifyPackagePrice(plan.price),
    dataLimit:plan.dataLimit
  };
}

export function validateBillPackageSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const expected = createBillPackageSnapshot(snapshot.packageId);
  if (!expected) return null;
  if (Object.keys(expected).every(key => snapshot[key] === expected[key])) return expected;
  // Keep the former PKR 100 amount valid only for historical bill/receipt snapshots.
  const legacy = snapshot.packageId === '3mbps-100gb' ? { ...expected, nominalPrice:100 } : null;
  return legacy && Object.keys(legacy).every(key => snapshot[key] === legacy[key]) ? legacy : null;
}
