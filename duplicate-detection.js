function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePhone(value) {
  const normalized = String(value ?? '').normalize('NFKC')
    .replace(/[٠-٩۰-۹]/g, digit => {
      const code = digit.codePointAt(0);
      return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
    });
  return normalized.replace(/\D/g, '');
}

function valuesOf(record, fields, normalizer) {
  return [...new Set(fields.map(field => normalizer(record?.[field])).filter(Boolean))];
}

function partialNameMatch(left, right) {
  if (!left || !right || left === right) return false;
  const leftParts = left.split(' ');
  const rightParts = right.split(' ');
  const shorter = leftParts.length <= rightParts.length ? leftParts : rightParts;
  const longer = shorter === leftParts ? rightParts : leftParts;
  if (!shorter.some(part => part.length >= 4)) return false;
  return shorter.every(part => longer.includes(part));
}

function partialAddressMatch(left, right) {
  if (!left || !right || left === right) return false;
  const shorter = left.length <= right.length ? left : right;
  const longer = shorter === left ? right : left;
  return shorter.length >= 10 && longer.includes(shorter);
}

/**
 * Return advisory matches only. This function does not mutate customer records,
 * persist data, or infer missing identifiers such as country codes.
 */
export function findPossibleDuplicateCustomers(customers, draft = {}) {
  const name = normalizeText(draft.name);
  const phone = normalizePhone(draft.phone);
  const address = normalizeText(draft.address);
  const mohalla = normalizeText(draft.mohalla);
  const zone = normalizeText(draft.zone);
  if (!name && !phone && !address) return [];

  const matches = [];
  for (const customer of Array.isArray(customers) ? customers : []) {
    const reasons = [];
    const savedNames = valuesOf(customer, ['name', 'customerName'], normalizeText);
    const savedPhones = valuesOf(customer, ['phone', 'customerPhone'], normalizePhone);
    const savedAddresses = valuesOf(customer, ['address', 'customerAddress'], normalizeText);
    const savedMohallas = valuesOf(customer, ['mohalla'], normalizeText);
    const savedZones = valuesOf(customer, ['zone'], normalizeText);

    if (phone && savedPhones.includes(phone)) {
      reasons.push({ field: 'phone', type: 'exact', label: 'Phone number matches after removing formatting.' });
    }
    if (name && savedNames.includes(name)) {
      reasons.push({ field: 'name', type: 'exact', label: 'Name matches after normalizing case, spacing, and punctuation.' });
    } else if (name && savedNames.some(savedName => partialNameMatch(name, savedName))) {
      reasons.push({ field: 'name', type: 'partial', label: 'Name partly matches; this may be a different person with a similar name.' });
    }
    if (address && savedAddresses.includes(address)) {
      reasons.push({ field: 'address', type: 'exact', label: 'Address matches after normalizing case, spacing, and punctuation; people at the same address may be separate customers.' });
    } else if (address && savedAddresses.some(savedAddress => partialAddressMatch(address, savedAddress))) {
      reasons.push({ field: 'address', type: 'partial', label: 'Address partly matches; people at the same address may be separate customers.' });
    }

    // Area and zone are useful context, but are too common to trigger a match by themselves.
    if (reasons.length && mohalla && savedMohallas.includes(mohalla)) {
      reasons.push({ field: 'mohalla', type: 'context', label: 'Same saved Mohalla / area.' });
    }
    if (reasons.length && zone && savedZones.includes(zone)) {
      reasons.push({ field: 'zone', type: 'context', label: 'Same saved zone.' });
    }
    if (reasons.length) matches.push({ customer, reasons });
  }

  return matches.sort((left, right) => {
    const weight = match => match.reasons.reduce((sum, reason) => sum + ({ exact: 10, partial: 4, context: 1 }[reason.type] ?? 0), 0);
    return weight(right) - weight(left) || Number(left.customer.customerNumber ?? 0) - Number(right.customer.customerNumber ?? 0);
  });
}
