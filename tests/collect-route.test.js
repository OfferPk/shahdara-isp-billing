import test from 'node:test';
import assert from 'node:assert/strict';
import { isCollectHash, COLLECT_HASH, parseRoute } from '../screen-router.js';
import { isBulkCollectHash, BULK_COLLECT_HASH } from '../bulk-collect.js';

test('#263: #collect, #/collect, #collect/ and #quick-collect are the Quick Collect route', () => {
  assert.equal(COLLECT_HASH, '#/collect');
  for (const h of ['#collect', '#/collect', '#/collect/', '#COLLECT', '#quick-collect']) assert.equal(isCollectHash(h), true, h);
  for (const h of ['', '#', '#/home', '#/customers', '#collection', '#/bulk-collect', '#collect/bulk', '#customer=collect']) assert.equal(isCollectHash(h), false, h);
  assert.equal(parseRoute('#/collect'), null, 'not a screen: the screen underneath stays as it is');
});

test('#263: #/bulk-collect plus #collect/bulk aliases are the Bulk Collect route', () => {
  assert.equal(BULK_COLLECT_HASH, '#/bulk-collect');
  for (const h of ['#/bulk-collect', '#bulk-collect', '#collect/bulk', '#/collect/bulk', '#/collect/bulk/']) assert.equal(isBulkCollectHash(h), true, h);
  for (const h of ['#collect', '#/collect', '#/home', '']) assert.equal(isBulkCollectHash(h), false, h);
});
