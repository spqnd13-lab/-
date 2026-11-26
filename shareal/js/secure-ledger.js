// Only a publishable key is used in the browser. RLS enforces access to private rows.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Capture the invite marker before Supabase consumes and clears the URL fragment.
const inviteLanding = /(?:^|[&#])type=(invite|recovery)(?:&|$)/.test(location.hash);
const supabase = createClient('https://bnciuadsqytgjqhqfwht.supabase.co','sb_publishable_mRyXZfmbd8u-qOnTUKD72w_jsyoxqui',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const status=message=>{$('status').textContent=message;};
let activeListing=null, publicListings=[], currentUser=null, role=null;
let lookupVersion=0, sessionVersion=0, signingOut=false;
let loadedPublicId=null;
let closeImporter=null;
function discardImport(){
 if(closeImporter)closeImporter();
 closeImporter=null;
}
$('openLegacy').addEventListener('click',async()=>{
 if(role!=='admin'||!currentUser||signingOut)return;
 if(!$('legacyPanel').hidden)return;
 const version=sessionVersion;
 const active=()=>version===sessionVersion&&role==='admin'&&!!currentUser&&!signingOut;
 try{
  const {openImporter}=await import('./legacy-ledger-import.mjs');
  if(active()&&$('legacyPanel').hidden)closeImporter=openImporter({db:supabase,catalog:publicListings,active});
 }catch{if(active())status('가져오기 화면을 열지 못했습니다. 새로고침해 주세요.')}
});
const fields=['landlordName','landlordPhone','tenantName','tenantPhone','memo'];
function clearPrivate() {
 lookupVersion++;
 activeListing=null;
 loadedPublicId=null;
 $('contactForm').hidden=true;
 $('assignListing').disabled=true;
 $('assignee').value='';
 fields.forEach(id=>$(id).value='');
 $('listingTitle').textContent='';
}
function resetSessionView() {
 sessionVersion++;
 discardImport();
 clearPrivate();
 currentUser=null;
 role=null;
 $('account').textContent='';
 $('editor').hidden=true;
 $('adminTools').hidden=true;
 $('setPassword').hidden=true;
 $('newPassword').value='';
 $('confirmPassword').value='';
 $('assignee').replaceChildren();
 $('listing').value='';
 showUnitPlan();
 $('login').hidden=true;
 $('logout').hidden=false;
}
function canEditLoadedListing() {
 return !!role && !!activeListing && loadedPublicId === $('listing').value.trim();
}
function selectedPublic(){const matches=publicListings.filter(p=>p.id===$('listing').value.trim());return matches.length===1?matches[0]:null;}
function showUnitPlan() {
 const link=$('unitPlan'), href=selectedPublic()?.planHref;
 link.hidden=!href;
 if(href) link.href=href; else link.removeAttribute('href');
}
function selectionChanged() {
 clearPrivate();
 showUnitPlan();
 status('매물 조회를 눌러 선택한 매물의 연락처를 확인하세요.');
}
$('search')?.addEventListener('input',renderList);
$('listing').addEventListener('input',selectionChanged);
$('listing').addEventListener('change',selectionChanged);
function duplicateId(){return publicListings.filter(p=>p.id===$('listing').value.trim()).length>1;}
// ── 매물 목록 — 매물장처럼 찾아서 고릅니다 ────────────────────────
// 여기에는 연락처를 그리지 않습니다. 고른 뒤 보안 DB 조회로만 나옵니다.
const LIST_MAX = 60;

function listRowText(p) {
 return [p.title, p.address, p.dongHo, p.id, p.type, p.tradeType].filter(Boolean).join(' ').toLowerCase();
}

function renderList() {
 const box = $('listBox'); if (!box) return;
 const q = ($('search')?.value || '').trim().toLowerCase();
 const hit = q ? publicListings.filter(p => listRowText(p).includes(q)) : publicListings;
 const shown = hit.slice(0, LIST_MAX);
 const chosen = $('listing').value.trim();
 box.replaceChildren(...shown.map(p => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'row' + (p.id === chosen ? ' on' : '');
  const t = document.createElement('span');
  const name = document.createElement('b'); name.textContent = p.title || p.id;
  const sub = document.createElement('small');
  sub.textContent = [p.address, p.dongHo, p.type, p.tradeType].filter(Boolean).join(' · ');
  t.append(name, sub);
  const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = p.id;
  b.append(t, tag);
  b.addEventListener('click', () => {
   $('listing').value = p.id;
   renderList();
   $('lookupForm').requestSubmit();
  });
  return b;
 }));
 $('listCount').textContent = hit.length
  ? (hit.length > LIST_MAX ? `${hit.length}건 중 ${LIST_MAX}건 표시 — 더 좁혀서 검색해 보세요.` : `${hit.length}건`)
  : '찾는 매물이 없습니다. 다른 말로 검색해 보세요.';
}

async function loadPublic(){
 try { const response=await fetch('data/properties.json',{cache:'no-store'}); if(!response.ok)throw Error('public catalog unavailable');
  const data=await response.json();publicListings=data.filter(p=>typeof p.id==='string'&&p.id.trim()).map(p=>({id:p.id,title:p.title||p.id,createdById:p.createdById,address:p.address,dongHo:p.dongHo,type:p.type,tradeType:p.tradeType,status:p.status,floor:p.floor,planHref:(()=>{try{return window.Plan3D&&typeof window.Plan3D.tripleTowerHref==='function'?window.Plan3D.tripleTowerHref(p):null;}catch(e){return null;}})()}));
  $('listingSuggestions').replaceChildren(...publicListings.map(p=>{const option=document.createElement('option');option.value=p.id;option.label=p.title;return option;}));
  showUnitPlan();
  $('catalogCount').textContent=`공개 매물 ${publicListings.length}건에서 찾을 수 있습니다.`;
  renderList();
 } catch {status('공개 매물 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');}
}
async function refresh(){
 discardImport();
 const version=++sessionVersion;
 const {data:{user},error}=await supabase.auth.getUser();
 if(version!==sessionVersion||signingOut)return;
 currentUser=error?null:user;
 $('logout').hidden=!currentUser;
 clearPrivate();role=null;$('editor').hidden=true;$('login').hidden=!!currentUser;$('adminTools').hidden=true;
 $('setPassword').hidden=!(currentUser&&inviteLanding);
 if(!currentUser)return;
 const {data:membership,error:membershipError}=await supabase.from('hb_staff_memberships').select('role,active').eq('user_id',currentUser.id).maybeSingle();
 if(version!==sessionVersion)return;
 if(membershipError||!membership?.active){status('계정 인증은 완료됐지만 직원 권한이 아직 승인되지 않았습니다. 관리자에게 문의하세요.');return;}
 role=membership.role;$('editor').hidden=false;$('account').textContent=`${currentUser.email||'직원'} · ${role==='admin'?'대표자':'담당 직원'}`;
 $('adminTools').hidden=role!=='admin';
 if(role==='admin'){
  const {data:members}=await supabase.from('hb_staff_memberships').select('user_id,role,active').eq('role','staff').eq('active',true);
  if(version!==sessionVersion)return;
  $('assignee').replaceChildren(new Option('담당자 지정 안 함',''),...(members||[]).map(m=>new Option(m.user_id,m.user_id)));
 }
 status('매물번호를 선택해 비공개 연락처를 조회하세요.');
}
$('setPasswordForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const first=$('newPassword').value,again=$('confirmPassword').value;
 if(first.length<12||first!==again){status('비밀번호는 12자 이상으로 입력하고 두 칸을 같게 입력하세요.');return;}
 const {error}=await supabase.auth.updateUser({password:first});
 $('newPassword').value='';$('confirmPassword').value='';
 if(error){status('비밀번호 설정에 실패했습니다. 초대 링크를 다시 확인하세요.');return;}
 $('setPassword').hidden=true;status('비밀번호를 설정했습니다. 이제 보안 매물장을 사용할 수 있습니다.');
});
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();status('로그인 확인 중…');
 const {error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 $('password').value='';if(error){status('로그인에 실패했습니다. 계정 또는 비밀번호를 확인하세요.');return;}
 await refresh();
});
$('logout').addEventListener('click',async()=>{
 if(signingOut)return;
 signingOut=true;
 resetSessionView();
 $('logout').disabled=true;
 status('로그아웃 확인 중…');
 try {
  const result=await supabase.auth.signOut();
  const check=await supabase.auth.getSession();
  if(check.error)throw check.error;
  if(check.data.session){
   status('로그인 세션이 남아 있습니다. 로그아웃을 다시 눌러 주세요.');
   return;
  }
  $('login').hidden=false;
  $('logout').hidden=true;
  status(result.error?'이 기기의 세션은 종료됐습니다. 서버 로그아웃은 확인하지 못했습니다.':'로그아웃되었습니다.');
 } catch {
  $('logout').hidden=false;
  $('login').hidden=true;
  status('로그아웃 여부를 확인하지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.');
 } finally {
  signingOut=false;
  $('logout').disabled=false;
 }
});
$('lookupForm').addEventListener('submit',async e=>{
 e.preventDefault();clearPrivate();const id=$('listing').value.trim();if(!id||!currentUser||!role)return;
 const version=lookupVersion;
 const stillSelected=()=>version===lookupVersion && id===$('listing').value.trim();
 if(!selectedPublic()){status(duplicateId()?'중복된 공개 매물번호입니다. 번호 정리 전에는 보안 DB에 연결할 수 없습니다.':'현재 공개 매물 목록에 없는 번호입니다. 매물번호를 다시 확인하세요.');return;}
 const {data:listing,error}=await supabase.from('hb_listings').select('id,title,legacy_listing_id,assigned_user_id').eq('legacy_listing_id',id).maybeSingle();
 if(!stillSelected())return;
 if(error){status('매물 조회가 거부되었거나 보안 DB가 아직 준비되지 않았습니다.');return;}
 if(!listing){status(role==='admin'?'보안 DB에 연결되지 않았습니다. 아래 관리자 연결 버튼을 누르세요.':'보안 DB에 연결되지 않았거나 담당 권한이 없습니다.');return;}
 const {data:contact,error:contactError}=await supabase.from('hb_listing_private_contacts').select('landlord_name,landlord_phone,tenant_name,tenant_phone,private_memo').eq('listing_id',listing.id).maybeSingle();
 if(!stillSelected())return;
 if(contactError){status('연락처 조회 권한이 없습니다.');return;}
 loadedPublicId=id;activeListing=listing.id;$('assignListing').disabled=role!=='admin';$('listingTitle').textContent=listing.title+' · '+listing.legacy_listing_id;
 $('landlordName').value=contact?.landlord_name||'';$('landlordPhone').value=contact?.landlord_phone||'';
 $('tenantName').value=contact?.tenant_name||'';$('tenantPhone').value=contact?.tenant_phone||'';$('memo').value=contact?.private_memo||'';
 $('contactForm').hidden=false;if(role==='admin')$('assignee').value=listing.assigned_user_id||'';
 status('비공개 연락처를 조회했습니다.');
});
$('connectListing').addEventListener('click',async()=>{
 if(role!=='admin'||!currentUser)return;const p=selectedPublic();if(!p){status(duplicateId()?'중복 매물번호는 연결할 수 없습니다.':'공개 매물번호를 먼저 선택하세요.');return;}
 const version=lookupVersion;
 const assignee=$('assignee').value||null;
 const {data:existing,error:readError}=await supabase.from('hb_listings').select('id').eq('legacy_listing_id',p.id).maybeSingle();
 if(version!==lookupVersion||selectedPublic()!==p)return;
 if(readError){status('보안 DB 매물을 확인할 수 없습니다.');return;}
 if(existing){status('이미 연결된 매물입니다. 매물 조회를 누르세요.');return;}
 const {error}=await supabase.from('hb_listings').insert({legacy_listing_id:p.id,title:p.title,assigned_user_id:assignee});
 if(version!==lookupVersion)return;
 status(error?'연결에 실패했습니다. 매물번호 또는 권한을 확인하세요.':'공개 매물번호가 연결되었습니다. 매물 조회를 누르세요.');
});
$('assignListing').addEventListener('click',async()=>{
 if(role!=='admin'||!canEditLoadedListing())return;
 const version=lookupVersion;
 const {error}=await supabase.from('hb_listings').update({assigned_user_id:$('assignee').value||null,updated_at:new Date().toISOString()}).eq('id',activeListing);
 if(version!==lookupVersion)return;
 status(error?'담당자 변경에 실패했습니다.':'담당자 권한을 변경했습니다.');
});
$('contactForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!canEditLoadedListing())return;
 const version=lookupVersion;status('저장 중…');
 const payload={listing_id:activeListing,landlord_name:$('landlordName').value.trim(),landlord_phone:$('landlordPhone').value.trim(),tenant_name:$('tenantName').value.trim(),tenant_phone:$('tenantPhone').value.trim(),private_memo:$('memo').value.trim(),updated_at:new Date().toISOString()};
 const {error}=await supabase.from('hb_listing_private_contacts').upsert(payload,{onConflict:'listing_id'});
 if(version!==lookupVersion)return;
 status(error?'저장에 실패했습니다. 담당 권한 및 DB 정책을 확인하세요.':'비공개 DB에 저장했습니다.');
});
supabase.auth.onAuthStateChange((event,session)=>{
 if(event==='SIGNED_OUT'){
  resetSessionView();
  if(!signingOut){
   $('logout').hidden=true;
   $('login').hidden=false;
   status('로그인 세션이 종료되었습니다.');
  }
 }else if(event==='SIGNED_IN'&&currentUser&&session?.user?.id!==currentUser.id){
  resetSessionView();
  setTimeout(refresh,0);
 }
});
await loadPublic();await refresh();
