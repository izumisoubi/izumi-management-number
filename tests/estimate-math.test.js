const assert = require('node:assert/strict');
const math = require('../見積計算共通.js');

const cases = [
  ['fullwidth decimal', () => assert.equal(math.numberOrNull('１．０３'), 1.03)],
  ['fullwidth formula', () => assert.equal(math.numberOrNull('＝５×１０＋４'), 54)],
  ['parenthesized formula', () => assert.equal(math.numberOrNull('=(5+4)*1.1'), 9.9)],
  ['comma and yen', () => assert.equal(math.numberOrNull('￥１，２３４．５０'), 1234.5)],
  ['unfinished decimal remains transient', () => assert.equal(math.isTransientNumericText('1.0'), true)],
  ['unfinished formula remains transient', () => assert.equal(math.isTransientNumericText('=5*'), true)],
  ['invalid expression rejected', () => assert.equal(math.numberOrNull('=alert(1)'), null)],
  ['division by zero rejected', () => assert.equal(math.numberOrNull('=1/0'), null)],
  ['cost amount keeps decimal quantity', () => assert.equal(math.costAmount('110.6', '1500'), 165900)],
  ['customer amount uses rounded unit price', () => assert.equal(math.customerAmount('3', '1000', '25'), 3999)],
  ['manual customer unit wins', () => assert.equal(math.customerAmount('3', '1000', '25', '1500'), 4500)],
  ['discount without unit clears amount', () => assert.equal(math.customerAmount('1', '', '25', '', 'discount'), null)],
  ['discount formula calculates', () => assert.equal(math.customerAmount('1', '', '25', '=-48000-60', 'discount'), -48060)],
  ['landlord gross drives rate', () => assert.deepEqual(math.burdenSplitFromGross(100000, 33000), {
    landlordRate: 30, tenantRate: 70, landlordGross: 33000, tenantGross: 77000, totalGross: 110000
  })],
  ['legacy rows preserve target total', () => {
    const rows = math.reconstructImportedEstimateRows([
      {item_name: 'A', cost_amount_ex_tax: 100},
      {item_name: 'B', cost_amount_ex_tax: 200}
    ], 1000);
    assert.equal(rows.reduce((sum, row) => sum + Number(row.sellOverride || 0), 0), 1000);
  }]
];

let passed = 0;
for (const [name, test] of cases) {
  try {
    test();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}
console.log(`${passed}/${cases.length} passed`);
