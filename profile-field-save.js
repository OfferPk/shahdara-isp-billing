// profile-field-save.js — per-field Save for the Customer Profile edit form.
//
// The profile edit form used to have exactly one save control ("Save
// profile") at the bottom, so saving one field (say the phone number)
// meant scrolling past ~69 fields and saving everything at once —
// including half-typed edits elsewhere. Each `.profile-field` now gets
// its own Save button on the same line as its control (wired in app.js);
// this module is the pure mapping behind those buttons.
//
// One input id maps to exactly one customer field key, matching the
// full-save patch in app.js field for field, so a per-field save goes
// through the same `updateCustomerProfile` validation and persistence
// as the full save. Nothing here reads or writes any store, bill,
// payment, visit, or lifecycle record — it only describes the patch.
//
// Deliberately NOT mapped (no per-field Save button):
// - saveProrataVoucherCheckbox / roundProrataCreditCheckbox /
//   roundProrataModeSelect: save options for the full save, not fields.
// - The contributor editor and the incident/uptime forms: separate
//   editors with their own save flows, not `.profile-field` labels.

export const PROFILE_FIELD_SAVE_MAP = Object.freeze({
  profileNameInput: 'name',
  nameUrduInput: 'nameUrdu',
  fatherOrReferenceNameInput: 'fatherOrReferenceName',
  searchAliasesInput: 'searchAliases',
  mohallaInput: 'mohalla',
  zoneInput: 'zone',
  upstreamCustomerInput: 'upstreamCustomerId',
  fiberZoneInput: 'fiberZone',
  feederHostCreditInput: 'feederHostCreditPKR',
  addressInput: 'address',
  customerNotesInput: 'notes',
  phoneInput: 'phone',
  whatsappPhoneInput: 'whatsappPhone',
  alternatePhoneInput: 'alternatePhone',
  prefersSmsCheckbox: 'prefersSms',
  preferredReceiptLangSelect: 'preferredReceiptLang',
  preferredReceiptChannelSelect: 'preferredReceiptChannel',
  cnicInput: 'cnic',
  ispProviderInput: 'ispProvider',
  serviceStatusInput: 'serviceStatus',
  preferredVisitWindowInput: 'preferredVisitWindow',
  connectionTypeInput: 'connectionType',
  pauseBillingCheckbox: 'paused',
  pauseStartDateInput: 'pauseStartDate',
  autoResumeDateInput: 'autoResumeDate',
  doNotSuspendUntilInput: 'doNotSuspendUntil',
  doNotSuspendReasonInput: 'doNotSuspendReason',
  packageSpeedInput: 'packageSpeed',
  monthlyPurchaseCostInput: 'monthlyPurchaseCost',
  monthlySellingAmountInput: 'monthlySellingAmount',
  seasonalRateInput: 'seasonalRatePKR',
  seasonalUntilMonthInput: 'seasonalUntilMonth',
  seasonalRestoreRateInput: 'restorePackageRatePKR',
  connectionDateInput: 'connectionDate',
  connectionFeeInput: 'connectionFee',
  routerModelInput: 'routerModel',
  routerPriceInput: 'routerPrice',
  fiberMetersInput: 'fiberMeters',
  splitterBoxIdInput: 'splitterBoxId',
  splitterPortInput: 'splitterPort',
  oltPonPortInput: 'oltPonPort',
  lastRxDbmInput: 'lastRxDbm',
  onuConnectorTypeInput: 'onuConnectorType',
  converterSideInput: 'customerConverterSide',
  poleNumberInput: 'poleNumber',
  boxLocationNoteInput: 'boxLocationNote',
  dropWireCoreColorInput: 'dropWireCoreColor',
  mediaConverterCostInput: 'mediaConverterCost',
  linemanInstallFeeInput: 'linemanInstallFee',
  installedByLinemanInput: 'installedByLineman',
  fiberPerMeterRateInput: 'fiberPerMeterRate',
  pppoeUsernameInput: 'pppoeUsername',
  pppoePasswordInput: 'pppoePassword',
  staticIpInput: 'staticIp',
  macAddressInput: 'macAddress',
  wifiSsidInput: 'wifiSsid',
  wifiPasswordInput: 'wifiPassword',
  routerAdminPortInput: 'routerAdminPort',
  routerAdminPasswordInput: 'routerAdminPassword',
  routerOwnershipInput: 'routerOwnership',
  mediaConverterOwnershipInput: 'mediaConverterOwnership',
  serialNumberInput: 'serialNumber',
  securityDepositInput: 'securityDeposit',
  residenceTypeInput: 'residenceType',
  landlordOrGuarantorNameInput: 'landlordOrGuarantorName',
  landlordPhoneInput: 'landlordPhone',
  expiryDateInput: 'expiryDate',
  cancellationDateInput: 'cancellationDate',
  packageChangeStaffNameInput: 'packageChangeStaffName',
});

// Build one single-field patch from a form control, or null when the
// control has no per-field save. `control` is duck-typed ({ type,
// value, checked }) so this stays testable without a DOM. Checkboxes
// save a boolean; every other control saves its raw value, exactly as
// the full save passes it to updateCustomerProfile (core trims and
// sanitises from there).
export function profileFieldSaveEntry(inputId, control) {
  const key = PROFILE_FIELD_SAVE_MAP[inputId];
  if (!key || !control) return null;
  if (control.type === 'checkbox') return { key, value: control.checked === true };
  return { key, value: typeof control.value === 'string' ? control.value : '' };
}

// Plan 499 — Cancel means Close when nothing is unsaved.
//
// A per-field Save persists its field immediately, so "unsaved" here
// means "differs from the stored record" — NOT "differs from the
// values the form opened with" (that is the Plan 498 save-button
// baseline in ui-feedback.js, which still counts a per-field-saved
// value as changed). A field counts as dirty only when its current
// value differs from BOTH the stored record and the value the form
// opened with: the open-time value covers the derived pre-fills
// renderDetail writes (serviceStatus 'not-set', visit window
// 'anytime', connectionType 'residential', searchAliases joined with
// ', ', seasonal restore pre-filled with the applicable rate), which
// differ from the stored record on an untouched form. Closing never
// reverts a per-field-saved value: the stored record already holds
// it, so renderDetail re-renders it back unchanged.
//
// `controls` is an iterable of duck-typed controls ({ id, type,
// value, checked }); `openValues` maps control id to the duck-typed
// control captured when the form opened, or null when no snapshot
// exists (then dirty means "differs from the stored record" only —
// the safe direction, towards confirming). Controls with no map entry
// (save options, contributor editor, incident/uptime forms) are not
// profile fields and never count here.

// Current value of one control, in the same shape as its stored
// baseline: booleans for checkboxes, trimmed strings otherwise.
function profileFieldCurrentValue(control) {
  if (control.type === 'checkbox') return control.checked === true;
  return typeof control.value === 'string' ? control.value.trim() : '';
}

// Stored value of one field, in the same shape: booleans stay
// booleans (an unset checkbox reads as false), arrays join the way
// the form renders them, everything else is a trimmed string.
function profileFieldStoredValue(raw, isCheckbox) {
  if (isCheckbox) return raw === true;
  if (raw === null || raw === undefined) return '';
  if (Array.isArray(raw)) return raw.join(', ');
  return String(raw).trim();
}

function profileFieldValuesEqual(a, b) {
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  return String(a ?? '').trim() === String(b ?? '').trim();
}

export function dirtyProfileFieldKeys(customer, controls, openValues) {
  const dirty = [];
  for (const control of controls || []) {
    const key = PROFILE_FIELD_SAVE_MAP[control?.id];
    if (!key || !control) continue;
    const current = profileFieldCurrentValue(control);
    if (profileFieldValuesEqual(current, profileFieldStoredValue(customer?.[key], control.type === 'checkbox'))) continue;
    const open = openValues?.[control.id];
    if (open !== undefined && open !== null && profileFieldValuesEqual(current, profileFieldCurrentValue(open))) continue;
    dirty.push(key);
  }
  return dirty;
}

export function hasUnsavedProfileEdits(customer, controls, openValues) {
  return dirtyProfileFieldKeys(customer, controls, openValues).length > 0;
}
