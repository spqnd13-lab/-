// Browser-side Supabase publishable key only. Never put service_role or secret keys here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://bnciuadsqytgjqhqfwht.supabase.co','sb_publishable_mRyXZfmbd8u-qOnTUKD72w_jsyoxqui',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const status=message=>{$('status').textContent=message;};
let activeListing=null;
const fields=['landlordName','landlordPhone','tenantName','tenantPhone','memo'];
function clearPrivate(){activeListing=null;$('contactForm').hidden=true;fields.forEach(id=>$(id).value='');$('listingTitle').textContent='';}
async function refresh(){
 const {data:{user},error}=await supabase.auth.getUser();
 if(error || !user){$('login').hidden=false;$('editor').hidden=true;clearPrivate();return;}
 $('login').hidden=true;$('editor').hidden=false;$('account').textContent=user.email||'인증된 직원';
}
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();status('로그인 확인 중…');
 const {error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 $('password').value='';if(error){status('로그인에 실패했습니다. 계정 또는 비밀번호를 확인하세요.');return;}
 status('로그인되었습니다. 관리자 권한 승인이 필요할 수 있습니다.');await refresh();
});
$('logout').addEventListener('click',async()=>{clearPrivate();await supabase.auth.signOut();status('로그아웃되었습니다.');await refresh();});
$('lookupForm').addEventListener('submit',async e=>{
 e.preventDefault();clearPrivate();const id=$('listing').value.trim();if(!id)return;
 const {data:listing,error}=await supabase.from('hb_listings').select('id,title,legacy_listing_id').eq('legacy_listing_id',id).maybeSingle();
 if(error){status('매물 조회가 거부되었거나 데이터베이스가 아직 준비되지 않았습니다.');return;}
 if(!listing){status('보안 DB에서 접근 가능한 매물이 없습니다. 관리자에게 매물 연결 및 담당 권한을 확인하세요.');return;}
 activeListing=listing.id;$('listingTitle').textContent=listing.title+' · '+listing.legacy_listing_id;
 const {data:contact,error:contactError}=await supabase.from('hb_listing_private_contacts').select('landlord_name,landlord_phone,tenant_name,tenant_phone,private_memo').eq('listing_id',activeListing).maybeSingle();
 if(contactError){clearPrivate();status('연락처 조회 권한이 없습니다.');return;}
 $('landlordName').value=contact?.landlord_name||'';$('landlordPhone').value=contact?.landlord_phone||'';
 $('tenantName').value=contact?.tenant_name||'';$('tenantPhone').value=contact?.tenant_phone||'';
 $('memo').value=contact?.private_memo||'';$('contactForm').hidden=false;status('비공개 연락처를 조회했습니다.');
});
$('contactForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!activeListing)return;status('저장 중…');
 const payload={listing_id:activeListing,landlord_name:$('landlordName').value.trim(),landlord_phone:$('landlordPhone').value.trim(),tenant_name:$('tenantName').value.trim(),tenant_phone:$('tenantPhone').value.trim(),private_memo:$('memo').value.trim(),updated_at:new Date().toISOString()};
 const {error}=await supabase.from('hb_listing_private_contacts').upsert(payload,{onConflict:'listing_id'});
 status(error?'저장에 실패했습니다. 담당 권한 및 DB 정책을 확인하세요.':'비공개 DB에 저장했습니다.');
});
supabase.auth.onAuthStateChange(()=>{clearPrivate();setTimeout(()=>{void refresh();},0);});
void refresh().then(()=>status('로그인 후 보안 DB의 매물을 조회할 수 있습니다.'));
