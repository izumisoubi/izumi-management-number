const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const backup = require('../バックアップ共通.js');

assert.equal(backup.parseAndValidate(JSON.stringify({v:21,rows:[],basic:{}})).v,21);
assert.throws(()=>backup.parseAndValidate('{'),/JSON/);
assert.throws(()=>backup.parseAndValidate('[]'),/バックアップ/);
assert.throws(()=>backup.parseAndValidate('{"hello":"world"}'),/見積システム/);
assert.throws(()=>backup.parseAndValidate(JSON.stringify({rows:{}})),/配列/);
assert.throws(()=>backup.parseAndValidate(JSON.stringify({rows:[{type:'broken'}]})),/行種別/);
assert.throws(()=>backup.parseAndValidate(JSON.stringify({rows:[{type:'item',qty:{}}]})),/数値/);
const roundtripSource=fs.readFileSync(path.join(__dirname,'fixtures','roundtrip.json'),'utf8');
const restored=backup.parseAndValidate(roundtripSource);
assert.deepEqual(JSON.parse(JSON.stringify(restored)),JSON.parse(roundtripSource));
console.log('8/8 passed');
