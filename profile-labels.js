const SERVICE_STATUS_LABELS = Object.freeze({
  active: 'Active',
  offline: 'Offline',
  'not-set': 'Not set'
});

export function profileArchiveLabel(isArchived, archivedSinceLabel = '') {
  if (!isArchived) return 'Profile: Active';
  return archivedSinceLabel ? `Profile: Archived since ${archivedSinceLabel}` : 'Profile: Archived';
}

export function manualServiceStatusLabel(serviceStatus) {
  const label = Object.hasOwn(SERVICE_STATUS_LABELS, serviceStatus)
    ? SERVICE_STATUS_LABELS[serviceStatus]
    : 'Not set';
  return `Service status: ${label}`;
}
