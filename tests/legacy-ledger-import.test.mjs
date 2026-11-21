import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {prepare,transfer,unlock} from '../shareal/js/legacy-ledger-import.mjs';

const target={id:'A',title:'검증용 매물',dongHo:'201호'};
const record={...target,contacts:{ownerName:'소유자 예시',clientPhone:'테스트 연락처',privateMemo:'메모 예시'}};
function database(){
 const listing=new Map(), contacts=new Map();
 return {listing,contacts,from(table){
  const records=table==='hb_listings'?listing:contacts;let filters={},patch;
  const matches=()=>[...records.values()].filter(row=>Object.entries(filters).every(([k,v])=>row[k]===v));
  const query={
   eq(k,v){filters[k]=v;return this},is(k,v){return this.eq(k,v)},
   select(){if(!patch)return this;const rows=matches();rows.forEach(r=>Object.assign(r,patch));return {data:rows}},
   maybeSingle(){return {data:matches()[0]??null}},update(v){patch=v;return this},
   insert(v){const key=v.legacy_listing_id||v.listing_id;if(records.has(key))return {error:{code:'23505'}};
    records.set(key,{id:'db-A',updated_at:'t0',landlord_phone:null,tenant_name:null,...v});return {}}
  };return query;
 }};
}
test('unique matching, ambiguous rows and mismatched unit stay distinguishable',()=>{
 assert.equal(prepare([record],[target])[0].reason,'');
 for(const rows of [[record,record],[{...record,dongHo:'202호'}]])assert.ok(prepare(rows,[target]).every(r=>r.reason));
 assert.ok(prepare([record],[target,target])[0].reason);
 assert.ok(prepare([record],[])[0].reason);
});
test('first import, retry, empty-field fill and conflicting saved value',async()=>{
 const db=database(),row=prepare([record],[target])[0],active=()=>true;
 assert.equal(await transfer(db,row,active),'저장 완료');
 assert.equal(await transfer(db,row,active),'이미 저장됨');
 const old=db.contacts.get('db-A');assert.equal(old.tenant_phone,record.contacts.clientPhone);
 const more={...row,values:{...row.values,landlord_phone:'예시 추가'}};
 assert.equal(await transfer(db,more,active),'저장 완료');assert.equal(old.landlord_phone,'예시 추가');
 old.landlord_name='보존할 값';assert.match(await transfer(db,row,active),/기존 값/);assert.equal(old.landlord_name,'보존할 값');
 await assert.rejects(transfer(db,row,()=>false));
});
test('current encrypted export format can be opened only with its original passphrase',async()=>{
 const salt=webcrypto.getRandomValues(new Uint8Array(16)),iv=webcrypto.getRandomValues(new Uint8Array(12));
 const pw='fixture-only',base=await webcrypto.subtle.importKey('raw',Buffer.from(pw),'PBKDF2',false,['deriveKey']);
 const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:600000,salt},base,{name:'AES-GCM',length:256},false,['encrypt']);
 const ct=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,Buffer.from(JSON.stringify({properties:[record]})));
 const b=v=>Buffer.from(v).toString('base64');
 const enc={format:'SHAREAL-SECURE-1',kdf:'PBKDF2-SHA256',iter:600000,salt:b(salt),iv:b(iv),ct:b(ct)};
 assert.deepEqual(await unlock(enc,pw),[record]);await assert.rejects(unlock(enc,'wrong-fixture'));
});
