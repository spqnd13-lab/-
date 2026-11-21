// Run with node --test tests/secure-ledger-ui.cjs. All records and sessions are fixtures.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../shareal/js/secure-ledger.js'), 'utf8')
  .replace(/^import .*supabase-js.*$/m, '');
async function fixture() {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', handlers: {}, addEventListener(name, handler) {this.handlers[name] = handler},
      replaceChildren() {}, removeAttribute(name) {delete this[name]}
    });
    return elements.get(id);
  };
  const user = {id: 'user', email: 'demo@example.invalid'};
  const state = {session: {user}, writes: [], contacts: async id => ({data:{landlord_name:id}})};
  const auth = {
    getUser: async () => ({data:{user}}),
    getSession: async () => ({data:{session:state.session}}),
    signOut: async () => {state.session=null; auth.listener('SIGNED_OUT',null);return {}},
    onAuthStateChange(fn) {auth.listener=fn}
  };
  const client = {auth, from(table) {
    let key;
    return {
      select() {return this}, eq(_,v) {key=v;return this},
      maybeSingle() {
        if(table==='hb_staff_memberships') return {data:{role:'admin',active:true}};
        if(table==='hb_listings') return {data:{id:key,title:key,legacy_listing_id:key}};
        return state.contacts(key);
      },
      async upsert(data) {state.writes.push(data.listing_id);return {}}
    };
  }};
  await vm.runInNewContext('(async()=>{'+script+'})()', {
    createClient:()=>client, location:{hash:''}, document:{getElementById:get,createElement:()=>({})},
    window:{Plan3D:{tripleTowerHref:()=>null}},Option:class {},setTimeout,
    fetch:async()=>({ok:true,json:async()=>[{id:'A'},{id:'B'}]})
  });
  const fire = (id,evt) => get(id).handlers[evt]({preventDefault(){}});
  const select = id => {get('listing').value=id;fire('listing','input')};
  return {get,fire,select,auth,state,lookup:()=>fire('lookupForm','submit'),logout:()=>fire('logout','click')};
}

test('switching clears contact fields and prevents a save until the new lookup completes',async()=>{
  const t=await fixture();
  t.select('A');await t.lookup();assert.equal(t.get('landlordName').value,'A');
  t.select('B');assert.equal(t.get('landlordName').value,'');
  assert.equal(t.get('contactForm').hidden,true);assert.equal(t.get('assignListing').disabled,true);
  await t.fire('contactForm','submit');assert.deepEqual(t.state.writes,[]);
  await t.lookup();await t.fire('contactForm','submit');assert.deepEqual(t.state.writes,['B']);
});
test('a late earlier lookup cannot replace the current contact or reopen a logged-out form',async()=>{
  for(const action of ['switch','logout']){
    const t=await fixture();let release,started;
    const pending=new Promise(resolve=>started=resolve);
    t.state.contacts=id=>id==='A'?new Promise(resolve=>{release=resolve;started()}):{data:{landlord_name:id}};
    t.select('A');const old=t.lookup();await pending;
    if(action==='switch'){t.select('B');await t.lookup()}else await t.logout();
    release({data:{landlord_name:'A'}});await old;
    assert.equal(t.get('landlordName').value,action==='switch'?'B':'');
    assert.equal(t.get('contactForm').hidden,action==='logout');
  }
});
test('a confirmed logout closes private UI and shows login',async()=>{
  const t=await fixture();t.select('A');await t.lookup();await t.logout();
  assert.equal(t.get('landlordName').value,'');assert.equal(t.get('editor').hidden,true);
  assert.equal(t.get('login').hidden,false);assert.equal(t.get('status').textContent,'로그아웃되었습니다.');
});
for(const failure of ['session retained','network exception','session check failed']){
  test('logout stays locked and offers retry: '+failure,async()=>{
    const t=await fixture();const normal=t.auth.signOut,check=t.auth.getSession;
    t.select('A');await t.lookup();
    t.auth.signOut=async()=>{if(failure==='network exception')throw Error();return {error:Error()}};
    if(failure==='session check failed')t.auth.getSession=async()=>({error:Error()});
    await t.logout();assert.notEqual(t.get('status').textContent,'로그아웃되었습니다.');
    assert.equal(t.get('editor').hidden,true);assert.equal(t.get('landlordName').value,'');
    assert.equal(t.get('logout').hidden,false);assert.equal(t.get('logout').disabled,false);
    t.auth.signOut=normal;t.auth.getSession=check;await t.logout();
    assert.equal(t.get('status').textContent,'로그아웃되었습니다.');
  });
}
