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
