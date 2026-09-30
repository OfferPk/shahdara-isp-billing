import test from 'node:test';
import assert from 'node:assert/strict';
import { manualServiceStatusLabel, profileArchiveLabel } from '../profile-labels.js';

test('profile archive state and manual service status use distinct, independent labels', () => {
  const syntheticCases = [
    {
      archived: false,
      archivedSinceLabel: '',
      serviceStatus: 'not-set',
      profileLabel: 'Profile: Active',
      serviceLabel: 'Service status: Not set'
    },
    {
      archived: true,
      archivedSinceLabel: 'synthetic date',
      serviceStatus: 'not-set',
      profileLabel: 'Profile: Archived since synthetic date',
      serviceLabel: 'Service status: Not set'
    },
    {
      archived: false,
      archivedSinceLabel: '',
      serviceStatus: 'active',
      profileLabel: 'Profile: Active',
      serviceLabel: 'Service status: Active'
    },
    {
      archived: true,
      archivedSinceLabel: 'synthetic date',
      serviceStatus: 'active',
      profileLabel: 'Profile: Archived since synthetic date',
      serviceLabel: 'Service status: Active'
    },
    {
      archived: false,
      archivedSinceLabel: '',
      serviceStatus: 'offline',
      profileLabel: 'Profile: Active',
      serviceLabel: 'Service status: Offline'
    },
    {
      archived: true,
      archivedSinceLabel: 'synthetic date',
      serviceStatus: 'offline',
      profileLabel: 'Profile: Archived since synthetic date',
      serviceLabel: 'Service status: Offline'
    }
  ];

  for (const item of syntheticCases) {
    assert.equal(profileArchiveLabel(item.archived, item.archivedSinceLabel), item.profileLabel);
    assert.equal(manualServiceStatusLabel(item.serviceStatus), item.serviceLabel);
  }
});
