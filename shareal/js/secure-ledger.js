// Only a publishable key is used in the browser. RLS enforces access to private rows.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://bnciuadsqytgjqhqfwht.supabase.co','sb_publishable_mRyXZfmbd8u-qOnTUKD72w_jsyoxqui',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const status=message=>{$('status').textContent=message;};
let activeListing=null, publicListings=[], currentUser=null, role=null;
const fields=['landlordName','landlordPhone','tenantName','tenantPhone','memo'];
function clearPrivate(){activeListing=null;$('contactForm').hidden=true;fields.forEach(id=>$(id).value='');$('listingTitle').textContent='';}
function selectedPublic(){const matches=publicListings.filter(p=>p.id===$('listing').value.trim());return matches.length===1?matches[0]:null;}
function duplicateId(){return publicListings.filter(p=>p.id===$('listing').value.trim()).length>1;}
async function loadPublic(){
 try { const response=await fetch('data/properties.json',{cache:'no-store'}); if(!response.ok)throw Error('public catalog unavailable');
  const data=await response.json();publicListings=data.filter(p=>typeof p.id==='string'&&p.id.trim()).map(p=>({id:p.id,title:p.title||p.id,createdById:p.createdById}));
  $('listingSuggestions').replaceChildren(...publicListings.map(p=>{const option=document.createElement('option');option.value=p.id;option.label=p.title;return option;}));
  $('catalogCount').textContent=`공개 매물 ${publicListings.length}건의 번호를 조회할 수 있습니다.`;
 } catch {status('공개 매물 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');}
}
async function refresh(){
 const {data:{user},error}=await supabase.auth.getUser();currentUser=error?null:user;
 clearPrivate();role=null;$('editor').hidden=true;$('login').hidden=!!currentUser;$('adminTools').hidden=true;
 if(!currentUser)return;
 const {data:membership,error:membershipError}=await supabase.from('hb_staff_memberships').select('role,active').eq('user_id',currentUser.id).maybeSingle();
 if(membershipError||!membership?.active){status('계정 인증은 완료됐지만 직원 권한이 아직 승인되지 않았습니다. 관리자에게 문의하세요.');return;}
 role=membership.role;$('editor').hidden=false;$('account').textContent=`${currentUser.email||'직원'} · ${role==='admin'?'대표자':'담당 직원'}`;
 $('adminTools').hidden=role!=='admin';
 if(role==='admin'){
  const {data:members}=await supabase.from('hb_staff_memberships').select('user_id,role,active').eq('role','staff').eq('active',true);
  $('assignee').replaceChildren(new Option('담당자 지정 안 함',''),...(members||[]).map(m=>new Option(m.user_id,m.user_id)));
 }
 status('매물번호를 선택해 비공개 연락처를 조회하세요.');
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();status('로그인 확인 중…');
 const {error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 $('password').value='';if(error){status('로그인에 실패했습니다. 계정 또는 비밀번호를 확인하세요.');return;}
 await refresh();
});
$('logout').addEventListener('click',async()=>{clearPrivate();await supabase.auth.signOut();currentUser=null;await refresh();status('로그아웃되었습니다.');});
$('lookupForm').addEventListener('submit',async e=>{
 e.preventDefault();clearPrivate();const id=$('listing').value.trim();if(!id)return;
 if(!selectedPublic()){status(duplicateId()?'중복된 공개 매물번호입니다. 번호 정리 전에는 보안 DB에 연결할 수 없습니다.':'현재 공개 매물 목록에 없는 번호입니다. 매물번호를 다시 확인하세요.');return;}
 const {data:listing,error}=await supabase.from('hb_listings').select('id,title,legacy_listing_id,assigned_user_id').eq('legacy_listing_id',id).maybeSingle();
 if(error){status('매물 조회가 거부되었거나 보안 DB가 아직 준비되지 않았습니다.');return;}
 if(!listing){status(role==='admin'?'보안 DB에 연결되지 않았습니다. 아래 관리자 연결 버튼을 누르세요.':'보안 DB에 연결되지 않았거나 담당 권한이 없습니다.');return;}
 const {data:contact,error:contactError}=await supabase.from('hb_listing_private_contacts').select('landlord_name,landlord_phone,tenant_name,tenant_phone,private_memo').eq('listing_id',listing.id).maybeSingle();
 if(contactError){status('연락처 조회 권한이 없습니다.');return;}
 activeListing=listing.id;$('listingTitle').textContent=listing.title+' · '+listing.legacy_listing_id;
 $('landlordName').value=contact?.landlord_name||'';$('landlordPhone').value=contact?.landlord_phone||'';
 $('tenantName').value=contact?.tenant_name||'';$('tenantPhone').value=contact?.tenant_phone||'';$('memo').value=contact?.private_memo||'';
 $('contactForm').hidden=false;if(role==='admin')$('assignee').value=listing.assigned_user_id||'';
 status('비공개 연락처를 조회했습니다.');
});
$('connectListing').addEventListener('click',async()=>{
 if(role!=='admin'||!currentUser)return;const p=selectedPublic();if(!p){status(duplicateId()?'중복 매물번호는 연결할 수 없습니다.':'공개 매물번호를 먼저 선택하세요.');return;}
 const {data:existing,error:readError}=await supabase.from('hb_listings').select('id').eq('legacy_listing_id',p.id).maybeSingle();
 if(readError){status('보안 DB 매물을 확인할 수 없습니다.');return;}
 if(existing){status('이미 연결된 매물입니다. 매물 조회를 누르세요.');return;}
 const {error}=await supabase.from('hb_listings').insert({legacy_listing_id:p.id,title:p.title,assigned_user_id:$('assignee').value||null});
 status(error?'연결에 실패했습니다. 매물번호 또는 권한을 확인하세요.':'공개 매물번호가 연결되었습니다. 매물 조회를 누르세요.');
});
$('assignListing').addEventListener('click',async()=>{
 if(role!=='admin'||!activeListing)return;
 const {error}=await supabase.from('hb_listings').update({assigned_user_id:$('assignee').value||null,updated_at:new Date().toISOString()}).eq('id',activeListing);
 status(error?'담당자 변경에 실패했습니다.':'담당자 권한을 변경했습니다.');
});
$('contactForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!activeListing||!role)return;status('저장 중…');
 const payload={listing_id:activeListing,landlord_name:$('landlordName').value.trim(),landlord_phone:$('landlordPhone').value.trim(),tenant_name:$('tenantName').value.trim(),tenant_phone:$('tenantPhone').value.trim(),private_memo:$('memo').value.trim(),updated_at:new Date().toISOString()};
 const {error}=await supabase.from('hb_listing_private_contacts').upsert(payload,{onConflict:'listing_id'});
 status(error?'저장에 실패했습니다. 담당 권한 및 DB 정책을 확인하세요.':'비공개 DB에 저장했습니다.');
});
supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){clearPrivate();role=null;$('editor').hidden=true;$('login').hidden=false;}});
await loadPublic();await refresh();
