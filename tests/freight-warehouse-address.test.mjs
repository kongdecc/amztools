import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('../public/freight-invoice/warehouse-address-parser.js',import.meta.url),'utf8'),context);
const parse=text=>JSON.parse(JSON.stringify(context.parseWarehouseAddress(text)));

test('US warehouse address on one line and multiple lines',()=>{
  const expected={code:'SCK4',address:'6001 S Austin Rd',city:'Stockton',state:'CA',postalCode:'95215',countryCode:'US',country:'美国'};
  for(const text of ['SCK4, 6001 S Austin Rd, Stockton, CA 95215, US','SCK4\n6001 S Austin Rd\nStockton, CA 95215\nUnited States','SCK4, 6001 S Austin Rd, Stockton, CA, 95215, USA'])assert.deepEqual(parse(text),expected);
});
test('Canada, UK and Europe retain postal codes',()=>{
  assert.deepEqual(parse('YYZ1, 6363 Millcreek Dr, Mississauga, ON L5N 1L8, Canada'),{code:'YYZ1',address:'6363 Millcreek Dr',city:'Mississauga',state:'ON',postalCode:'L5N 1L8',countryCode:'CA',country:'加拿大'});
  assert.equal(parse('BHX1\nTowers Business Park\nRugeley WS15 1LX\nUK').postalCode,'WS15 1LX');
  assert.equal(parse('BER3, Amazonstrasse 1, 14656 Brieselang, Germany').city,'Brieselang');
});
test('labeled fields and unknown text do not invent warehouse codes',()=>{
  assert.deepEqual(parse('仓库代码：abc1\n街道地址：123 Test Road\n城市：Boston\n州：MA\n邮编：02108\n国家代码：US'),{code:'ABC1',address:'123 Test Road',city:'Boston',state:'MA',postalCode:'02108',countryCode:'US',country:'美国'});
  assert.deepEqual(parse(''),{});
  assert.deepEqual(parse('123 Test Road'),{address:'123 Test Road'});
});
