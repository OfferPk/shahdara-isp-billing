import test from 'node:test';
import assert from 'node:assert/strict';
import { isCollectHash, COLLECT_HASH, parseRoute, quickCollectCustomerIdFromHash } from '../screen-router.js';
import { isBulkCollectHash, BULK_COLLECT_HASH } from '../bulk-collect.js';

test('#263: #collect, #/collect, #collect/ and #quick-collect are the Quick Collect route', () => {
  assert.equal(COLLECT_HASH, '#/collect');
  for (const h of ['#collect', '#/collect', '#/collect/', '#COLLECT', '#quick-collect']) assert.equal(isCollectHash(h), true, h);
  for (const h of ['', '#', '#/home', '#/customers', '#collection', '#/bulk-collect', '#collect/bulk', '#customer=collect']) assert.equal(isCollectHash(h), false, h);
  assert.equal(parseRoute('#/collect'), null, 'not a screen: the screen underneath stays as it is');
});

test('#quick-collect/<id> deep link (Top 5 Overdue) is the Quick Collect route and yields its customer id', () => {
  // The deep link is an opener: it belongs to the collect route so opening
  // replaces its history entry with #/collect — closing can never navigate
  // back onto it and reopen the sheet.
  for (const h of ['#quick-collect/seed-003', '#/quick-collect/seed-003', '#quick-collect/cust-42/']) assert.equal(isCollectHash(h), true, h);
  assert.equal(quickCollectCustomerIdFromHash('#quick-collect/seed-003'), 'seed-003');
  assert.equal(quickCollectCustomerIdFromHash('#/quick-collect/cust-42'), 'cust-42');
  assert.equal(quickCollectCustomerIdFromHash('#quick-collect'), null);
  assert.equal(quickCollectCustomerIdFromHash('#/collect'), null);
  assert.equal(quickCollectCustomerIdFromHash('#/home'), null);
  assert.equal(quickCollectCustomerIdFromHash(''), null);
});

test('#263: #/bulk-collect plus #collect/bulk aliases are the Bulk Collect route', () => {
  assert.equal(BULK_COLLECT_HASH, '#/bulk-collect');
  for (const h of ['#/bulk-collect', '#bulk-collect', '#collect/bulk', '#/collect/bulk', '#/collect/bulk/']) assert.equal(isBulkCollectHash(h), true, h);
  for (const h of ['#collect', '#/collect', '#/home', '']) assert.equal(isBulkCollectHash(h), false, h);
});
