const { test } = require('node:test');
const assert = require('node:assert/strict');

const SERVICES = ['kitchen', 'bath', 'outdoor', 'addition'].map(key => ({ key }));
const keys = async counts => {
  const { orderServices } = await import('../src/lib/services.mjs');
  return orderServices(SERVICES, counts).map(s => s.key);
};

test('services: highest count moves to the top', async () => {
  assert.deepEqual(await keys({ bath: 50, kitchen: 10, outdoor: 5, addition: 1 }), ['bath', 'kitchen', 'outdoor', 'addition']);
});

test('services: ties keep the original page order', async () => {
  assert.deepEqual(await keys({ kitchen: 3, bath: 3, outdoor: 3, addition: 3 }), ['kitchen', 'bath', 'outdoor', 'addition']);
});

test('services: missing or non-numeric counts count as zero', async () => {
  assert.deepEqual(await keys({ addition: 'abc', outdoor: 2 }), ['outdoor', 'kitchen', 'bath', 'addition']);
});

test('services: no counts keeps the original order', async () => {
  assert.deepEqual(await keys(null), ['kitchen', 'bath', 'outdoor', 'addition']);
});

test('services: default counts put kitchens first', async () => {
  const { DEFAULT_COUNTS } = await import('../src/lib/services.mjs');
  assert.equal((await keys(DEFAULT_COUNTS))[0], 'kitchen');
});
