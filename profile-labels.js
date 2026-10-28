import { t } from './nav-language.js';

const SERVICE_STATUS_LABELS = Object.freeze({
  active: 'prof_service_active',
  offline: 'prof_service_offline',
  'not-set': 'prof_not_set'
});

export function profileArchiveLabel(isArchived, archivedSinceLabel = '') {
  if (!isArchived) return t('prof_archive_active');
  return archivedSinceLabel ? t('prof_archive_since', null, { date: archivedSinceLabel }) : t('prof_archive_archived');
}

export function manualServiceStatusBareLabel(serviceStatus) {
  const key = Object.hasOwn(SERVICE_STATUS_LABELS, serviceStatus)
    ? SERVICE_STATUS_LABELS[serviceStatus]
    : 'prof_not_set';
  return t(key);
}

export function manualServiceStatusLabel(serviceStatus) {
  return t('prof_service_status', null, { label: manualServiceStatusBareLabel(serviceStatus) });
}
