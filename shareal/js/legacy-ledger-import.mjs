const fields = {
  ownerName: ['landlord_name', '소유자 이름', 100],
  ownerPhone: ['landlord_phone', '소유자 연락처', 30],
  clientName: ['tenant_name', '거래 고객 이름', 100],
  clientPhone: ['tenant_phone', '거래 고객 연락처', 30],
  privateMemo: ['private_memo', '비공개 메모', 2000]
};
const columns = Object.values(fields).map(([key])=>key).join(',');
const normalize = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ');
function countIds(records) {
  const counts = new Map();
  for (const record of records) counts.set(record?.id, (counts.get(record?.id)||0)+1);
  return counts;
}
export function prepare(records, catalog) {
  if (!Array.isArray(records)) throw Error('매물 목록을 읽을 수 없습니다.');
  const targetCounts=countIds(catalog);
  const key=p=>targetCounts.get(p?.id)>1?`${p.id}~${p.createdById||''}`:p?.id;
  const sourceKeys=countIds(records.map(p=>({id:key(p)})));
  const targetKeys=countIds(catalog.map(p=>({id:key(p)})));
  const targets=new Map(catalog.map(p=>[key(p),p]));
  const rows=[];
  for (const p of records) {
    const values={};
    for (const [from,[to]] of Object.entries(fields)) {
      const v=p?.contacts?.[from];
      if (typeof v==='string'&&v.trim()) values[to]=v.trim();
    }
    if (!Object.keys(values).length) continue;
    const listingKey=key(p),target=targets.get(listingKey);
    let reason='';
    if (sourceKeys.get(listingKey)>1||targetKeys.get(listingKey)>1) reason='매물번호·담당자 중복';
    else if (!target) reason='공개 매물번호 없음';
    else if (!normalize(p.title)||normalize(p.title)!==normalize(target.title)||
      ['address','dongHo'].some(k=>normalize(p[k])&&normalize(target[k])&&normalize(p[k])!==normalize(target[k]))) reason='매물 정보 불일치';
    else if (Object.values(fields).some(([k,,limit])=>(values[k]?.length||0)>limit)) reason='입력 길이 확인 필요';
    rows.push({id:p.id,key:listingKey,title:p.title||'',target,values,reason,result:''});
  }
  return rows;
}
export async function unlock(enc, password) {
  if(enc?.format!=='SHAREAL-SECURE-1'||enc.kdf!=='PBKDF2-SHA256'||enc.iter!==600000)
    throw Error('기존 매물장에서 만든 암호화 백업을 선택하세요.');
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(enc.salt),iterations:enc.iter},base,{name:'AES-GCM',length:256},false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(enc.iv)},key,bytes(enc.ct));
  return JSON.parse(new TextDecoder().decode(plain)).properties;
}
// Compare and set only previously empty fields. A concurrent edit causes a review result.
export async function transfer(db,row,valid) {
  const check=()=>{if(!valid()) throw Error('세션 종료')};
  async function readListing(){
    check();
    const {data,error}=await db.from('hb_listings').select('id,title').eq('legacy_listing_id',row.key).maybeSingle();
    if(error) throw error;
    return data;
  }
  let listing=await readListing();
  if(!listing){
    check();
    const res=await db.from('hb_listings').insert({legacy_listing_id:row.key,title:row.target.title,assigned_user_id:null});
    if(res.error&&res.error.code!=='23505')throw res.error;
    listing=await readListing();
  }
  if(!listing||normalize(listing.title)!==normalize(row.target.title))return '확인 필요 · DB 매물명';
  check();
  const table='hb_listing_private_contacts';
  const {data:old,error}=await db.from(table).select(columns+',updated_at').eq('listing_id',listing.id).maybeSingle();
  if(error)throw error;
  check();
  if(!old){
    const res=await db.from(table).insert({listing_id:listing.id,...row.values});
    if(res.error?.code==='23505')return '재확인 필요 · 동시 변경';
    if(res.error)throw res.error;
    return '저장 완료';
  }
  const entries=Object.entries(row.values);
  if(entries.some(([k,v])=>old[k]?.trim()&&old[k].trim()!==v))return '확인 필요 · 기존 값과 다름';
  const missing=entries.filter(([k])=>!old[k]?.trim());
  if(!missing.length)return '이미 저장됨';
  let query=db.from(table).update({...Object.fromEntries(missing),updated_at:new Date().toISOString()}).eq('listing_id',listing.id);
  query=query.eq('updated_at',old.updated_at);
  for(const [k] of missing)query=old[k]==null?query.is(k,null):query.eq(k,old[k]);
  const result=await query.select('listing_id');
  if(result.error)throw result.error;
  return result.data?.length===1?'저장 완료':'재확인 필요 · 동시 변경';
}

export function openImporter({db,catalog,active}) {
  const el=id=>document.getElementById(id);
  const panel=el('legacyPanel'), output=el('legacyRows'), message=el('legacyMessage');
  const preview=el('legacyPreview'),save=el('legacySave'),mode=el('legacySource');
  let rows=[],closed=false,busy=false;
  const valid=()=>!closed&&active();
  const clear=()=>{rows=[];output.replaceChildren();save.disabled=true;message.textContent=''};
  function controls(){
    mode.disabled=preview.disabled=busy;
    el('legacyBackup').disabled=el('legacyPass').disabled=busy;
    save.disabled=busy||!rows.some(r=>!r.reason&&!['저장 완료','이미 저장됨'].includes(r.result));
  }
  function sourceChange(){
    clear();el('legacyBackup').value='';el('legacyPass').value='';
    el('legacyFileBox').hidden=mode.value!=='file';
    el('legacyPassBox').hidden=mode.value==='local';
  }
  function render(){
    output.replaceChildren();
    for(const row of rows){
      const detail=document.createElement('details'),head=document.createElement('summary'),body=document.createElement('p');
      head.textContent=[row.id,row.title,row.reason||row.result||'저장 대상'].filter(Boolean).join(' · ');
      body.style.whiteSpace='pre-wrap';
      body.textContent=Object.values(fields).filter(([k])=>row.values[k]).map(([k,label])=>label+' · '+row.values[k]).join('\n');
      detail.append(head,body);output.append(detail);
    }
    controls();
  }
  mode.value='local';sourceChange();panel.hidden=false;
  mode.onchange=sourceChange;
  preview.onclick=async()=>{
    if(!valid()||busy)return;
    clear();busy=true;controls();
    try{
      let records;
      if(mode.value==='local'){
        const keys=Object.keys(localStorage).filter(k=>/^SMART_BROKER_PROPERTIES_V\d+$/.test(k)).sort((a,b)=>Number(b.split('_V').pop())-Number(a.split('_V').pop()));
        if(!keys.length)throw Error('기기 자료 없음');
        records=JSON.parse(localStorage.getItem(keys[0]));
      }else{
        let enc;
        if(mode.value==='file'){
          const file=el('legacyBackup').files[0];if(!file)throw Error('파일 없음');
          enc=JSON.parse(await file.text());
        }else{
          const res=await fetch('secure/private.enc.json',{cache:'no-store'});if(!res.ok)throw Error('백업 없음');
          enc=await res.json();
        }
        if(!valid())return;
        records=await unlock(enc,el('legacyPass').value);
      }
      if(!valid())return;
      rows=prepare(records,catalog);render();
      message.textContent='연락처가 있는 매물 '+rows.length+'건 · 저장 대상 '+rows.filter(r=>!r.reason).length+'건. 매물명을 누르면 기존 연락처가 보입니다.';
    }catch{
      if(valid())message.textContent=mode.value==='local'?'이 브라우저에서 기존 자료를 읽지 못했습니다. 암호화 백업을 선택하세요.':'백업을 열지 못했습니다. 파일과 보안자료 비밀번호를 확인하세요.';
    }finally{if(valid()){el('legacyPass').value='';busy=false;controls()}}
  };
  save.onclick=async()=>{
    if(!valid()||busy)return;
    busy=true;controls();
    el('legacyClose').disabled=true;
    try{
      for(const row of rows){
        if(!valid())return;
        if(row.reason||['저장 완료','이미 저장됨'].includes(row.result))continue;
        try{row.result=await transfer(db,row,valid)}
        catch{if(valid()){row.result='저장 실패 · 다시 시도 가능';break}}
      }
      if(valid()){
        render();
        const ok=rows.filter(r=>['저장 완료','이미 저장됨'].includes(r.result)).length;
        message.textContent='저장 완료 또는 기존 값 일치 '+ok+'건 · 미저장 '+(rows.length-ok)+'건. 저장된 매물은 매물번호로 조회하세요.';
      }
    }finally{if(valid()){busy=false;el('legacyClose').disabled=false;controls()}}
  };
  function close(){closed=true;clear();panel.hidden=true;el('legacyPass').value='';el('legacyBackup').value='';el('legacyClose').disabled=false;mode.onchange=preview.onclick=save.onclick=el('legacyClose').onclick=null}
  el('legacyClose').onclick=close;controls();return close;
}
