import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context={};
context.globalThis=context;
vm.runInNewContext(readFileSync(new URL('../年度共通.js',import.meta.url),'utf8'),context);

test('年度候補は2024年度から2030年度まで',()=>{
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.IzumiFiscalYear.options())),
    [
      {code:'31',label:'2030年度'},
      {code:'30',label:'2029年度'},
      {code:'29',label:'2028年度'},
      {code:'28',label:'2027年度'},
      {code:'27',label:'2026年度'},
      {code:'26',label:'2025年度'},
      {code:'25',label:'2024年度'}
    ]
  );
});
