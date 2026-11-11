/**
 * 송현아부동산공인중개사사무소 매물장 & 통합 관리 시스템 v3.5
 * 
 * 1. 보안 비밀번호(PIN) 로그인 체계:
 *    - 유수정 (대표자): 2114 (대표번호 032-811-2114 연동, 4016 호환)
 *    - 이은숙 (실장): 0502 (매물 등록, 본인 등록 매물 연락처만 열람)
 *    - 황규문 (과장): 5555 (매물 등록, 본인 등록 매물 연락처만 열람)
 * 2. 스마트폰 모바일 전용 반응형 카드 뷰 & 하단 고정 탭바 (현장 임장 원터치 통화 지원)
 * 3. 인천 전지역 10개 구·군 & 법정동 정밀 필터 (부천시, 서울시, 그외 분리)
 * 4. 카카오/다음 우편번호 & 도로명 주소 검색 자동 매핑
 * 5. 매물 접수 동시 6대 스마트 일정 연동 (미팅, 계약일, 작성일, 잔금일, 만기일, 재확인)
 * 6. 월별 그림 달력 및 임장 사진 다중 업로드 & 광고 다운로더
 */

// ==========================================
// 1. 인천광역시 전지역 10개 구·군 & 법정동 데이터베이스
// ==========================================
const INCHEON_REGIONS = {
  '부평구': ['부평동', '삼산동', '산곡동', '청천동', '갈산동', '부개동', '십정동', '일신동'],
  '미추홀구': ['주안동', '숭의동', '용현동', '학익동', '도화동', '관교동', '문학동'],
  '서구': ['청라동', '가정동', '신현동', '원창동', '석남동', '가좌동', '검암동', '경서동', '연희동', '당하동', '원당동', '마전동', '불로동', '오류동', '왕길동'],
  '연수구': ['송도동', '연수동', '청학동', '동춘동', '선학동', '옥련동'],
  '남동구': ['구월동', '간석동', '만수동', '논현동', '고잔동', '장수동', '서창동', '도림동'],
  '계양구': ['계산동', '작전동', '효성동', '서운동', '임학동', '박촌동', '병방동', '방축동', '귤현동', '동양동'],
  '중구': ['중산동', '운서동', '운남동', '운북동', '신흥동', '신포동', '북성동', '항동', '유동', '율목동', '답동'],
  '동구': ['송림동', '송현동', '만석동', '화수동', '화평동', '금곡동', '창영동'],
  '강화군': ['강화읍', '선원면', '불은면', '길상면', '화도면', '양도면', '내가면', '하점면', '양사면', '송해면', '교동면', '삼산면', '서도면'],
  '옹진군': ['백령면', '연평면', '대청면', '덕적면', '영흥면', '자월면', '북도면']
};

// ==========================================
// 2. 사용자 계정 및 보안 비밀번호(PIN) 모델
// ==========================================
const USERS = {
  admin: {
    id: 'user_admin',
    name: '유수정',
    title: '대표자',
    role: 'ADMIN',
    pin: '2114',
    badge: '👑 유수정 (대표자)',
    desc: '모든 매물 삭제 및 전 매물 연락처 확인 가능'
  },
  staff1: {
    id: 'user_staff1',
    name: '이은숙',
    title: '실장',
    role: 'STAFF',
    pin: '0502',
    badge: '👤 이은숙 (실장)',
    desc: '본인 등록 매물 연락처만 열람 가능 / 삭제 불가'
  },
  staff2: {
    id: 'user_staff2',
    name: '황규문',
    title: '과장',
    role: 'STAFF',
    pin: '5555',
    badge: '👤 황규문 (과장)',
    desc: '본인 등록 매물 연락처만 열람 가능 / 삭제 불가'
  }
};

const LOGIN_STORAGE_KEY = 'SONG_REALESTATE_USER_LOGIN_V5';
let currentUserKey = localStorage.getItem(LOGIN_STORAGE_KEY);
if (!USERS[currentUserKey]) {
  currentUserKey = null; // 첫 방문 시 미로그인 상태 (PIN 인증 필수)
}

let currentTab = 'listTab';
let currentStatusFilter = 'ALL'; // ALL | 진행중 | 거래완료 | 보류
let scheduleFilterType = 'ALL';
let calendarViewMode = 'MONTH'; // MONTH | TIMELINE

// 지역 필터 상태 (기본: 인천시 전체)
let currentCityFilter = '인천시';
let currentGuFilter = 'ALL';
let currentDongFilter = 'ALL';

// 달력 상태 (2026년 11월 기본)
let calYear = 2026;
let calMonth = 10; // 0-indexed: 10 = 11월 (11월 일정 즉시 표시)

// 모달 임시 사진
let uploadedPhotos = [];

// 갤러리 상태
let currentGalleryProperty = null;
let currentGalleryIndex = 0;

// ==========================================
// 3. 인천/부천/서울 실무 매물 데이터셋
// ==========================================
const DEFAULT_PROPERTIES = [
  {
    id: 'P-인천-01',
    regionCity: '인천시',
    regionGu: '부평구',
    regionDong: '부평동',
    type: '아파트',
    tradeType: '매매',
    title: '부평 동아 1단지',
    address: '인천광역시 부평구 부평동 70-5',
    dongHo: '105동 804호',
    deposit: 58000, // 5억 8천만원
    monthlyRent: 0,
    maintenanceFee: 18,
    area: '84.8㎡ (25평)',
    floor: '8층 / 15층',
    roomCount: '방3 / 화2',
    features: '부평역 초역세권(도보 5분), 올수리 인테리어, 남향 채광굿',
    publicMemo: 'GTX-B 호재 인접 단지. 매도인 이사 날짜 협의 가능.',
    status: '진행중',
    createdById: 'user_staff2',
    createdByName: '황규문 (과장)',
    createdAt: '2026-10-25',
    photos: [
      { id: 'ph1', name: '거실 전경', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80' },
      { id: 'ph2', name: '주방 싱크대', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1000&q=80' }
    ],
    contacts: {
      clientName: '정우성 손님',
      clientPhone: '010-8765-4321',
      ownerName: '최은경 매도인',
      ownerPhone: '010-3344-5566',
      privateMemo: '도어락 #9921*, 오후 2시 이후 방문 희망'
    },
    schedules: {
      meeting: { date: '2026-10-30T14:30', memo: '손님과 105동 1층 로비 미팅 후 안내' },
      contract: { date: '2026-11-05', memo: '계약금 5,800만원 입금 합의' },
      signing: { date: '2026-11-10T15:00', memo: '사무소에서 매매 본계약서 날인' },
      balance: { date: '2026-12-20', memo: '잔금일 및 소유권 이전등기' },
      expiry: { date: '', memo: '' },
      reminder: { date: '2026-10-29', memo: '오늘 매도인에게 가격 500만원 절충 의사 재확인' }
    }
  },
  {
    id: 'P-인천-02',
    regionCity: '인천시',
    regionGu: '서구',
    regionDong: '청라동',
    type: '아파트',
    tradeType: '매매',
    title: '청라호수공원 한양수자인',
    address: '인천광역시 서구 청라동 100-24',
    dongHo: '502동 1801호',
    deposit: 42000, // 4억 2천만원
    monthlyRent: 0,
    maintenanceFee: 22,
    area: '102.3㎡ (34평)',
    floor: '18층 / 30층',
    roomCount: '방4 / 화2',
    features: '호수공원 파노라마 뷰, 시스템에어컨 4대, 즉시입주',
    publicMemo: '집주인이 비거주 상태로 공실임. 비번으로 자유 답사 가능.',
    status: '진행중',
    createdById: 'user_staff2',
    createdByName: '황규문 (과장)',
    createdAt: '2026-10-27',
    photos: [
      { id: 'ph3', name: '호수공원 거실 조망', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80' },
      { id: 'ph4', name: '안방 및 드레스룸', url: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1000&q=80' }
    ],
    contacts: {
      clientName: '송혜교 손님',
      clientPhone: '010-7788-9900',
      ownerName: '박대호 임대인',
      ownerPhone: '010-2211-3322',
      privateMemo: '도어락 #1049*, 전세자금대출 적극 동의'
    },
    schedules: {
      meeting: { date: '2026-10-29T16:00', memo: '오후 4시 호수공원 뷰 선호 손님 투어' },
      contract: { date: '', memo: '' },
      signing: { date: '', memo: '' },
      balance: { date: '2026-11-20', memo: '입주일 잔금 치르기' },
      expiry: { date: '2026-10-15', memo: '이미 공실 상태' },
      reminder: { date: '2026-10-31', memo: '월말까지 계약 미체결시 전세가 1천 조정 권유' }
    }
  },
  {
    id: 'P-인천-03',
    regionCity: '인천시',
    regionGu: '연수구',
    regionDong: '송도동',
    type: '오피스텔',
    tradeType: '월세',
    title: '송도 더샵 센트럴파크',
    address: '인천광역시 연수구 송도동 23-4',
    dongHo: '102동 2503호',
    deposit: 2000,
    monthlyRent: 130,
    maintenanceFee: 16,
    area: '45.2㎡ (14평)',
    floor: '25층 / 40층',
    roomCount: '1.5룸 분리형',
    features: '센트럴파크 조망, 빌트인 풀옵션, 바이오단지 직장인 선호',
    publicMemo: '임차인 만기 임박. 실내 깔끔함.',
    status: '진행중',
    createdById: 'user_admin',
    createdByName: '유수정 (대표자)',
    createdAt: '2026-10-28',
    photos: [
      { id: 'ph5', name: '송도 센트럴뷰', url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80' }
    ],
    contacts: {
      clientName: '외국계기업 연구원 손님',
      clientPhone: '010-5555-7777',
      ownerName: '송도부동산투자(주)',
      ownerPhone: '032-831-9999',
      privateMemo: '세금계산서 발행 가능, 법인 명의 계약 환영'
    },
    schedules: {
      meeting: { date: '2026-11-02T11:00', memo: '법인 인사팀 담당자와 현장 답사' },
      contract: { date: '', memo: '' },
      signing: { date: '', memo: '' },
      balance: { date: '2026-12-01', memo: '입주일 잔금' },
      expiry: { date: '2026-11-28', memo: '현 임차인 만기 퇴거일' },
      reminder: { date: '2026-11-01', memo: '임차인에게 사전 방문 시간 재확인' }
    }
  },
  {
    id: 'P-인천-04',
    regionCity: '인천시',
    regionGu: '미추홀구',
    regionDong: '주안동',
    type: '아파트',
    tradeType: '매매',
    title: '힐스테이트 푸르지오 주안',
    address: '인천광역시 미추홀구 주안동 1445-1',
    dongHo: '108동 1402호',
    deposit: 49000, // 4억 9천만원
    monthlyRent: 0,
    maintenanceFee: 20,
    area: '74.5㎡ (22평)',
    floor: '14층 / 40층',
    roomCount: '방3 / 화2',
    features: '신축 대단지(2,958세대), 인천2호선 시민공원역 인접, 남향 판상형',
    publicMemo: '주안/숭의 랜드마크 신축 아파트. 신혼부부 및 갈아타기 인기.',
    status: '진행중',
    createdById: 'user_staff2',
    createdByName: '황규문 (과장)',
    createdAt: '2026-10-27',
    photos: [
      { id: 'ph8', name: '신축 거실 전경', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80' },
      { id: 'ph9', name: '주방 및 다이닝', url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1000&q=80' }
    ],
    contacts: {
      clientName: '주안 거주 손님',
      clientPhone: '010-6677-8899',
      ownerName: '장미추 매도인',
      ownerPhone: '010-1199-3344',
      privateMemo: '도어락 #7712*, 주말 오후 방문 가능'
    },
    schedules: {
      meeting: { date: '2026-11-01T15:00', memo: '주안 힐스테이트 108동 현장 안내' },
      contract: { date: '', memo: '' },
      signing: { date: '', memo: '' },
      balance: { date: '2026-12-30', memo: '연말 잔금' },
      expiry: { date: '', memo: '' },
      reminder: { date: '2026-10-31', memo: '주말 안내 미팅 1일 전 확인 전화' }
    }
  },
  {
    id: 'P-부천-01',
    regionCity: '부천시',
    regionGu: '',
    regionDong: '',
    type: '아파트',
    tradeType: '매매',
    title: '부천 중동 센트럴파크 푸르지오',
    address: '경기도 부천시 신흥로 200',
    dongHo: '103동 3102호',
    deposit: 92000, // 9억 2천만원
    monthlyRent: 0,
    maintenanceFee: 26,
    area: '84.9㎡ (25평)',
    floor: '31층 / 49층',
    roomCount: '방3 / 화2',
    features: '신중동역 도보 3분, 백화점 상권, 펜트하우스급 초고층 뷰',
    publicMemo: '부천 랜드마크 아파트. 인천 부평 바로 인접.',
    status: '진행중',
    createdById: 'user_staff2',
    createdByName: '황규문 (과장)',
    createdAt: '2026-10-26',
    photos: [
      { id: 'ph6', name: '초고층 거실 전경', url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80' }
    ],
    contacts: {
      clientName: '강남 이주 손님',
      clientPhone: '010-3322-1100',
      ownerName: '김중동 매도인',
      ownerPhone: '010-4499-8822',
      privateMemo: '매도인 평일 저녁 7시 이후 통화 가능'
    },
    schedules: {
      meeting: { date: '2026-11-03T19:00', memo: '저녁 7시 야경 뷰 투어' },
      contract: { date: '', memo: '' },
      signing: { date: '', memo: '' },
      balance: { date: '2027-01-15', memo: '잔금 지급' },
      expiry: { date: '', memo: '' },
      reminder: { date: '2026-11-02', memo: '손님 퇴근 후 방문 재확인 알림' }
    }
  },
  {
    id: 'P-서울-01',
    regionCity: '서울시',
    regionGu: '',
    regionDong: '',
    type: '아파트',
    tradeType: '매매',
    title: '마포 공덕 파크자이',
    address: '서울특별시 마포구 백범로 152',
    dongHo: '201동 1202호',
    deposit: 85000,
    monthlyRent: 0,
    maintenanceFee: 24,
    area: '84.8㎡ (25평)',
    floor: '12층 / 23층',
    roomCount: '방3 / 화2',
    features: '공덕역 4개 노선 쿼드러플 역세권, 경의선숲길 바로 앞',
    publicMemo: '서울 의뢰 매물 분리 관리.',
    status: '거래완료',
    createdById: 'user_staff2',
    createdByName: '황규문 (과장)',
    createdAt: '2026-10-20',
    photos: [
      { id: 'ph7', name: '공덕 파크자이 내부', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80' }
    ],
    contacts: {
      clientName: '금융사 임원 손님',
      clientPhone: '010-9988-1122',
      ownerName: '이지은 임대인',
      ownerPhone: '010-5566-7788',
      privateMemo: '전세 계약 만료 후 거래완료 정리됨'
    },
    schedules: {
      meeting: { date: '', memo: '' },
      contract: { date: '2026-10-22', memo: '가계약 완료' },
      signing: { date: '2026-10-25T14:00', memo: '계약서 작성 완료' },
      balance: { date: '2026-11-30', memo: '잔금 예정' },
      expiry: { date: '', memo: '' },
      reminder: { date: '', memo: '' }
    }
  }
];

// 총 281건 실무 매물 데이터베이스 우선 연동 (유수정 대표 10건 + 이은숙 실장 40건 + 황규문 과장 231건)
const ACTIVE_DEFAULT_PROPERTIES = (typeof INITIAL_PROPERTY_DATA !== 'undefined' && Array.isArray(INITIAL_PROPERTY_DATA) && INITIAL_PROPERTY_DATA.length > 0)
  ? INITIAL_PROPERTY_DATA
  : DEFAULT_PROPERTIES;

const STORAGE_KEY = 'SMART_BROKER_PROPERTIES_V18';

// 서버 동기화 함수 (server.js가 실행 중일 때 data/properties.json과 실시간 동기화)
async function fetchServerProperties() {
  try {
    const res = await fetch('./api/properties');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    // 오프라인 / 정적 무료 호스팅(GitHub Pages, Netlify 등)에서는 조용히 로컬스토리지 사용
  }
  return null;
}

async function postPropertiesToServer(properties) {
  try {
    await fetch('./api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(properties)
    });
  } catch (e) {
    // 무시
  }
}

function getStoredProperties() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ACTIVE_DEFAULT_PROPERTIES));
    return ACTIVE_DEFAULT_PROPERTIES;
  }
  try {
    let parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ACTIVE_DEFAULT_PROPERTIES));
      return ACTIVE_DEFAULT_PROPERTIES;
    }
    // 네이버 광고 종료일은 임대차 만기일이 아니므로, 이미 저장된 데이터에서도 만기일을 비움
    let adExpiryCleared = false;
    parsed.forEach(p => {
      const ex = p && p.schedules && p.schedules.expiry;
      if (ex && /네이버\s*광고/.test(ex.memo || '')) {
        p.schedules.expiry = { date: '', memo: '' };
        adExpiryCleared = true;
      }
    });
    if (adExpiryCleared) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    // 기본 매물의 최신 건물명 및 브리핑 동기화
    if (typeof ACTIVE_DEFAULT_PROPERTIES !== 'undefined' && Array.isArray(ACTIVE_DEFAULT_PROPERTIES)) {
      const defMap = new Map(ACTIVE_DEFAULT_PROPERTIES.map(p => [p.id, p]));
      parsed.forEach(p => {
        const def = defMap.get(p.id);
        if (def) {
          if (p.title !== def.title) p.title = def.title;
          if (def.features && p.features !== def.features) p.features = def.features;
          if (def.publicMemo && p.publicMemo !== def.publicMemo) p.publicMemo = def.publicMemo;
          if (def.schedules && def.schedules.expiry && def.schedules.expiry.date) {
            p.schedules = p.schedules || {};
            p.schedules.expiry = def.schedules.expiry;
          }
        }
      });
    }
    // 유수정 대표 실무 매물 (P-YSJ-01 ~ P-YSJ-21) 실시간 데이터 및 최신 일정 자동 동기화
    if (typeof YUSUJEONG_PROPERTIES !== 'undefined' && Array.isArray(YUSUJEONG_PROPERTIES)) {
      const ysjMap = new Map(YUSUJEONG_PROPERTIES.map(p => [p.id, p]));
      // 기존 저장된 YSJ 매물의 최신 연락처 및 일정 동기화
      parsed = parsed.map(p => {
        if (ysjMap.has(p.id)) {
          const fresh = ysjMap.get(p.id);
          return {
            ...p,
            contacts: fresh.contacts,
            schedules: fresh.schedules,
            features: fresh.features || p.features,
            publicMemo: fresh.publicMemo || p.publicMemo,
            deposit: fresh.deposit || p.deposit,
            monthlyRent: fresh.monthlyRent !== undefined ? fresh.monthlyRent : p.monthlyRent
          };
        }
        return p;
      });
      const existingIds = new Set(parsed.map(p => p.id));
      const missingYSJ = YUSUJEONG_PROPERTIES.filter(p => !existingIds.has(p.id));
      if (missingYSJ.length > 0) {
        parsed = [...missingYSJ, ...parsed];
      }
      const existingAllIds = new Set(parsed.map(p => p.id));
      const missingDefaults = ACTIVE_DEFAULT_PROPERTIES.filter(p => !existingAllIds.has(p.id));
      if (missingDefaults.length > 0) {
        parsed = [...missingDefaults, ...parsed];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    console.error('데이터 파싱 오류:', e);
    return ACTIVE_DEFAULT_PROPERTIES;
  }
}

function saveProperties(properties) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
  postPropertiesToServer(properties);
}

// ==========================================
// 3-1. 고객 데이터베이스 (CRM) 스토리지 & 서버 동기화
// ==========================================
const CLIENT_STORAGE_KEY = 'SMART_BROKER_CLIENTS_V1';
const ACTIVE_DEFAULT_CLIENTS = (typeof INITIAL_CLIENTS_DATA !== 'undefined' && Array.isArray(INITIAL_CLIENTS_DATA) && INITIAL_CLIENTS_DATA.length > 0)
  ? INITIAL_CLIENTS_DATA
  : [];

async function fetchServerClients() {
  try {
    const res = await fetch('./api/clients');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    // 오프라인 / 정적 호스팅 환경 자동 지원
  }
  return null;
}

async function postClientsToServer(clients) {
  try {
    await fetch('./api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clients)
    });
  } catch (e) {
    // 무시
  }
}

function getStoredClients() {
  const data = localStorage.getItem(CLIENT_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(ACTIVE_DEFAULT_CLIENTS));
    return ACTIVE_DEFAULT_CLIENTS;
  }
  try {
    let parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(ACTIVE_DEFAULT_CLIENTS));
      return ACTIVE_DEFAULT_CLIENTS;
    }
    // INITIAL_CLIENTS_DATA의 실시간 최신 데이터 자동 병합
    if (typeof INITIAL_CLIENTS_DATA !== 'undefined' && Array.isArray(INITIAL_CLIENTS_DATA)) {
      const initMap = new Map(INITIAL_CLIENTS_DATA.map(c => [c.id, c]));
      const existingIds = new Set(parsed.map(c => c.id));
      const missing = INITIAL_CLIENTS_DATA.filter(c => !existingIds.has(c.id));
      if (missing.length > 0) {
        parsed = [...parsed, ...missing];
        localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(parsed));
      }
    }
    return parsed;
  } catch (e) {
    console.error('고객 데이터 파싱 오류:', e);
    return ACTIVE_DEFAULT_CLIENTS;
  }
}

function saveClients(clients) {
  localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clients));
  postClientsToServer(clients);
}

// ==========================================
// 4. 보안 및 권한 검증 로직
// ==========================================
function checkCanViewContact(property) {
  if (!currentUserKey) return false;
  const user = USERS[currentUserKey];
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (property.createdById === user.id) return true;
  return false;
}

function checkCanDelete(property) {
  if (!currentUserKey) return false;
  const user = USERS[currentUserKey];
  return user && user.role === 'ADMIN';
}

function checkCanEdit(property) {
  if (!currentUserKey) return false;
  const user = USERS[currentUserKey];
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return property.createdById === user.id;
}

function checkCanViewClientContact(client) {
  if (!currentUserKey) return false;
  const user = USERS[currentUserKey];
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (client.createdById === user.id) return true;
  return false;
}

function checkCanDeleteClient(client) {
  if (!currentUserKey) return false;
  const user = USERS[currentUserKey];
  return user && user.role === 'ADMIN';
}

function checkCanEditClient(client) {
  if (!currentUserKey) return false;
  const user = USERS[currentUserKey];
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return client.createdById === user.id;
}

function safeCreateIcons() {
  try {
    if (typeof lucide !== 'undefined' && lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  } catch (err) {
    console.warn('아이콘 렌더링 대기:', err);
  }
}

// ==========================================
// 5. 카카오 / 다음 주소 검색 시스템 연동
// ==========================================
function openDaumPostcodeSearch() {
  if (typeof daum === 'undefined' || !daum.Postcode) {
    alert('카카오/다음 주소 검색 서비스를 로드하는 중입니다. 잠시 후 다시 시도해 주세요.');
    return;
  }

  new daum.Postcode({
    oncomplete: function(data) {
      let fullAddr = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress;
      if (!fullAddr) fullAddr = data.roadAddress || data.jibunAddress || '';

      let extraAddr = '';
      if (data.userSelectedType === 'R') {
        if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
          extraAddr += data.bname;
        }
        if (data.buildingName !== '' && data.apartment === 'Y') {
          extraAddr += (extraAddr !== '' ? ', ' + data.buildingName : data.buildingName);
        }
        if (extraAddr !== '') {
          fullAddr += ' (' + extraAddr + ')';
        }
      }

      document.getElementById('formAddress').value = fullAddr;

      const titleInput = document.getElementById('formTitle');
      if (data.buildingName && !titleInput.value.trim()) {
        titleInput.value = data.buildingName;
      }

      const sido = data.sido || '';
      const sigungu = data.sigungu || '';
      const bname = data.bname || '';

      let matchedCity = '그외';
      if (sido.includes('인천')) {
        matchedCity = '인천시';
      } else if (sigungu.includes('부천') || fullAddr.includes('부천시')) {
        matchedCity = '부천시';
      } else if (sido.includes('서울')) {
        matchedCity = '서울시';
      }

      const citySelect = document.getElementById('formRegionCity');
      citySelect.value = matchedCity;
      handleModalCityChange();

      if (matchedCity === '인천시') {
        const guSelect = document.getElementById('formRegionGu');
        for (const gu of Object.keys(INCHEON_REGIONS)) {
          if (sigungu.includes(gu) || fullAddr.includes(gu)) {
            guSelect.value = gu;
            handleModalGuChange();
            break;
          }
        }

        const dongSelect = document.getElementById('formRegionDong');
        const availableDongs = INCHEON_REGIONS[guSelect.value] || [];
        for (const dong of availableDongs) {
          if (bname.includes(dong) || fullAddr.includes(dong)) {
            dongSelect.value = dong;
            break;
          }
        }
      }

      document.getElementById('formDongHo').focus();
    }
  }).open();
}

// ==========================================
// 6. 지역 필터 및 모달 셀렉트 제어 엔진
// ==========================================
function initRegionControls() {
  const filterGuSelect = document.getElementById('filterGu');
  filterGuSelect.innerHTML = `<option value="ALL">인천 전체 구·군 (10개 구·군)</option>` + 
    Object.keys(INCHEON_REGIONS).map(gu => `<option value="${gu}">${gu}</option>`).join('');

  const modalGuSelect = document.getElementById('formRegionGu');
  modalGuSelect.innerHTML = Object.keys(INCHEON_REGIONS).map(gu => `<option value="${gu}">${gu}</option>`).join('');

  handleModalGuChange();
  handleFilterCityChange();
}

function handleFilterCityChange() {
  currentCityFilter = document.getElementById('filterCity').value;
  const guWrapper = document.getElementById('filterGuWrapper');
  const dongWrapper = document.getElementById('filterDongWrapper');

  if (currentCityFilter === '인천시') {
    guWrapper.classList.remove('hidden');
    handleFilterGuChange();
  } else {
    guWrapper.classList.add('hidden');
    dongWrapper.classList.add('hidden');
    currentGuFilter = 'ALL';
    currentDongFilter = 'ALL';
  }
  renderPropertyList();
}

function handleFilterGuChange() {
  currentGuFilter = document.getElementById('filterGu').value;
  const dongWrapper = document.getElementById('filterDongWrapper');
  const filterDongSelect = document.getElementById('filterDong');

  if (currentGuFilter !== 'ALL' && INCHEON_REGIONS[currentGuFilter]) {
    dongWrapper.classList.remove('hidden');
    const dongs = INCHEON_REGIONS[currentGuFilter];
    filterDongSelect.innerHTML = `<option value="ALL">${currentGuFilter} 전체 동</option>` +
      dongs.map(d => `<option value="${d}">${d}</option>`).join('');
  } else {
    dongWrapper.classList.add('hidden');
    currentDongFilter = 'ALL';
  }
  renderPropertyList();
}

function handleFilterDongChange() {
  currentDongFilter = document.getElementById('filterDong').value;
  renderPropertyList();
}

function quickSelectIncheonGu(guName) {
  document.getElementById('filterCity').value = '인천시';
  handleFilterCityChange();
  document.getElementById('filterGu').value = guName;
  handleFilterGuChange();
}

function quickSelectCity(cityName) {
  document.getElementById('filterCity').value = cityName;
  handleFilterCityChange();
}

function handleModalCityChange() {
  const city = document.getElementById('formRegionCity').value;
  const guContainer = document.getElementById('modalGuContainer');
  const dongContainer = document.getElementById('modalDongContainer');

  if (city === '인천시') {
    guContainer.classList.remove('hidden');
    dongContainer.classList.remove('hidden');
  } else {
    guContainer.classList.add('hidden');
    dongContainer.classList.add('hidden');
  }
}

function handleModalGuChange() {
  const gu = document.getElementById('formRegionGu').value;
  const dongSelect = document.getElementById('formRegionDong');
  const dongs = INCHEON_REGIONS[gu] || [];
  dongSelect.innerHTML = dongs.map(d => `<option value="${d}">${d}</option>`).join('');
}

// ==========================================
// 7. 포맷 및 계산 유틸리티
// ==========================================
function formatPrice(tradeType, deposit, monthlyRent) {
  const dep = Number(deposit) || 0;
  const rent = Number(monthlyRent) || 0;

  function toKoreanAmount(num) {
    if (num >= 10000) {
      const eok = Math.floor(num / 10000);
      const remainder = num % 10000;
      return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
    }
    return `${num.toLocaleString()}만`;
  }

  if (tradeType === '매매') {
    return `<span class="font-bold text-slate-900">매매 ${toKoreanAmount(dep)}원</span>`;
  } else if (tradeType === '전세') {
    return `<span class="font-bold text-brand-700">전세 ${toKoreanAmount(dep)}원</span>`;
  } else {
    return `<span class="font-bold text-emerald-700">월세 ${toKoreanAmount(dep)} / ${rent}만</span>`;
  }
}

function formatScheduleDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  if (dateStr.includes('T')) {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}.${day} ${hours}:${minutes}`;
  }
  return `${year}.${month}.${day}`;
}

function calculateDDay(targetDateStr) {
  if (!targetDateStr) return null;
  const target = new Date(targetDateStr.split('T')[0]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return { text: 'D-Day 오늘', cls: 'bg-rose-500 text-white font-bold animate-pulse' };
  if (diffDays > 0) return { text: `D-${diffDays}`, cls: diffDays <= 3 ? 'bg-amber-500 text-white font-bold' : 'bg-slate-200 text-slate-700' };
  return { text: `D+${Math.abs(diffDays)} 지남`, cls: 'bg-slate-100 text-slate-400' };
}

function compressImage(file, maxWidth = 900, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 8. 직원 보안 로그인 (PIN 인증: 유수정 4016, 이은숙 0502, 황규문 5555)
// ==========================================
let isLoginMandatory = false;

function openLoginModal(mandatory = false) {
  isLoginMandatory = mandatory || !currentUserKey;
  const modal = document.getElementById('loginModal');
  const closeBtn = document.getElementById('loginModalCloseBtn');

  if (closeBtn) {
    if (isLoginMandatory) {
      closeBtn.classList.add('hidden');
    } else {
      closeBtn.classList.remove('hidden');
    }
  }

  if (modal) {
    backToLoginSelect();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    safeCreateIcons();
  }
}

function closeLoginModal() {
  if (isLoginMandatory && !currentUserKey) {
    alert('송현아부동산 매물장을 이용하시려면 먼저 본인 계정으로 로그인해 주세요.');
    return;
  }
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function promptUserPin(userKey) {
  const user = USERS[userKey];
  if (!user) return;

  document.getElementById('loginTargetUserKey').value = userKey;
  document.getElementById('loginTargetUserName').textContent = user.badge;
  document.getElementById('loginPinInput').value = '';
  document.getElementById('loginPinError').classList.add('hidden');

  document.getElementById('loginStepSelect').classList.add('hidden');
  document.getElementById('loginPinForm').classList.remove('hidden');

  setTimeout(() => {
    document.getElementById('loginPinInput').focus();
  }, 100);
}

function backToLoginSelect() {
  document.getElementById('loginStepSelect').classList.remove('hidden');
  document.getElementById('loginPinForm').classList.add('hidden');
  document.getElementById('loginPinError').classList.add('hidden');
  document.getElementById('loginPinInput').value = '';
}

// 모바일 원터치 숫자 키패드 지원 함수
function keypadPress(digit) {
  const input = document.getElementById('loginPinInput');
  if (input && input.value.length < 6) {
    input.value += digit;
    document.getElementById('loginPinError').classList.add('hidden');
  }
}

function keypadClear() {
  const input = document.getElementById('loginPinInput');
  if (input) {
    input.value = '';
    document.getElementById('loginPinError').classList.add('hidden');
  }
}

function keypadBackspace() {
  const input = document.getElementById('loginPinInput');
  if (input && input.value.length > 0) {
    input.value = input.value.slice(0, -1);
  }
}

function handleVerifyPin(e) {
  e.preventDefault();
  const targetKey = document.getElementById('loginTargetUserKey').value;
  const inputPin = document.getElementById('loginPinInput').value.trim();
  const user = USERS[targetKey];

  if (!user) return;

  const isValid = (inputPin === user.pin) || (targetKey === 'admin' && inputPin === '4016');
  if (!isValid) {
    const errorP = document.getElementById('loginPinError');
    errorP.textContent = '비밀번호가 올바르지 않습니다. 다시 입력해 주세요.';
    errorP.classList.remove('hidden');
    document.getElementById('loginPinInput').focus();
    return;
  }

  // 로그인 성공
  currentUserKey = targetKey;
  localStorage.setItem(LOGIN_STORAGE_KEY, targetKey);
  isLoginMandatory = false;

  closeLoginModal();
  refreshAll();

  alert(`🔓 ${user.badge}님 환영합니다!\n보안 인증이 완료되었습니다.`);
}

function handleLogout() {
  if (confirm('현재 계정에서 로그아웃 하시겠습니까?')) {
    currentUserKey = null;
    localStorage.removeItem(LOGIN_STORAGE_KEY);
    refreshAll();
    openLoginModal(true);
  }
}

// 매물 데이터 백업 및 복원 (JSON 파일)
function toggleBackupMenu() {
  const menu = document.getElementById('backupDropdownMenu');
  if (menu) menu.classList.toggle('hidden');
}

function exportDataBackup() {
  const properties = getStoredProperties();
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const blob = new Blob([JSON.stringify(properties, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `송현아부동산_매물백업_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toggleBackupMenu();
}

function importDataBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (Array.isArray(data)) {
        if (confirm(`선택한 파일에서 총 ${data.length}건의 매물을 복원하시겠습니까?\n현재 브라우저 및 서버 매물 데이터가 갱신됩니다.`)) {
          saveProperties(data);
          refreshAll();
          alert('매물 데이터가 성공적으로 복원되었습니다.');
        }
      } else {
        alert('올바른 매물 백업 JSON 파일 형식이 아닙니다.');
      }
    } catch (err) {
      alert('파일을 읽는 도중 오류가 발생했습니다: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
  toggleBackupMenu();
}

function resetToHomeScreen() {
  switchTab('listTab');

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  const filterTradeType = document.getElementById('filterTradeType');
  if (filterTradeType) filterTradeType.value = 'ALL';

  currentStatusFilter = 'ALL';
  updateStatusButtonStyles();

  const filterCity = document.getElementById('filterCity');
  if (filterCity) {
    filterCity.value = '인천시';
    handleFilterCityChange();
  }

  const filterGu = document.getElementById('filterGu');
  if (filterGu) {
    filterGu.value = 'ALL';
    handleFilterGuChange();
  }

  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();

  refreshAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStatusButtonStyles() {
  document.querySelectorAll('.status-tab-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-status') === currentStatusFilter;
    if (isTarget) {
      btn.className = 'status-tab-btn py-1.5 px-2 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-xs whitespace-nowrap transition-all border border-slate-200/80';
    } else {
      btn.className = 'status-tab-btn py-1.5 px-2 text-xs font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap transition-all';
    }
  });
}

// ==========================================
// 실시간 면적 (㎡ ↔ 평) 상호 자동 환산 엔진
// ==========================================
function handleAreaM2Input(val) {
  const m2 = parseFloat(val);
  const pyInput = document.getElementById('calcAreaPy');
  const formArea = document.getElementById('formArea');
  if (isNaN(m2) || m2 <= 0) {
    if (pyInput) pyInput.value = '';
    return;
  }
  // 평 = ㎡ × 0.3025 (소수점 1자리)
  const py = (m2 * 0.3025).toFixed(1);
  if (pyInput) pyInput.value = py;
  if (formArea) {
    formArea.value = `전용 ${py}평 (${m2}㎡)`;
  }
}

function handleAreaPyInput(val) {
  const py = parseFloat(val);
  const m2Input = document.getElementById('calcAreaM2');
  const formArea = document.getElementById('formArea');
  if (isNaN(py) || py <= 0) {
    if (m2Input) m2Input.value = '';
    return;
  }
  // ㎡ = 평 / 0.3025 (소수점 2자리)
  const m2 = (py / 0.3025).toFixed(2);
  if (m2Input) m2Input.value = m2;
  if (formArea) {
    formArea.value = `전용 ${py}평 (${m2}㎡)`;
  }
}

function updateRoleBanner() {
  const banner = document.getElementById('roleAlertBanner');
  const bannerText = document.getElementById('roleAlertText');
  const user = currentUserKey ? USERS[currentUserKey] : null;

  const userNameDisplay = document.getElementById('currentUserNameDisplay');
  const mobileUserNameDisplay = document.getElementById('mobileUserNameDisplay');
  const mobileLabel = document.getElementById('mobileUserBtnLabel');

  if (!user) {
    if (userNameDisplay) userNameDisplay.textContent = '로그인 필요';
    if (mobileUserNameDisplay) mobileUserNameDisplay.textContent = '로그인';
    if (mobileLabel) mobileLabel.textContent = '로그인';
    if (banner) {
      banner.className = 'bg-rose-50 border-b border-rose-200 px-3 sm:px-4 py-1.5 sm:py-2 transition-all';
      bannerText.innerHTML = `현재 <strong>로그인되지 않은 상태</strong>입니다. [계정전환] 또는 하단 [로그인]을 눌러 비밀번호를 입력해 주세요.`;
    }
    return;
  }

  if (userNameDisplay) userNameDisplay.textContent = user.badge;
  // 모바일 화면에서 세로 1글자씩 줄바꿈 깨짐을 방지하기 위한 컴팩트 표기
  if (mobileUserNameDisplay) {
    mobileUserNameDisplay.textContent = user.role === 'ADMIN' ? `👑 ${user.name}` : `👤 ${user.name}`;
  }
  if (mobileLabel) mobileLabel.textContent = user.name;

  if (user.role === 'ADMIN') {
    banner.className = 'bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-3 sm:px-4 py-1.5 sm:py-2 transition-all';
    bannerText.innerHTML = `현재 <strong>${user.badge}</strong> 모드: <span class="text-emerald-700 font-semibold underline">전 매물 비밀연락처 열람</span> 및 <span class="text-rose-700 font-semibold underline">삭제 권한</span> 활성화됨`;
  } else {
    banner.className = 'bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-3 sm:px-4 py-1.5 sm:py-2 transition-all';
    bannerText.innerHTML = `현재 <strong>${user.badge}</strong> 모드: 타 직원 매물 고객 연락처는 <span class="text-rose-600 font-bold underline">🔒 비공개 차단</span>됩니다.`;
  }
}

function switchTab(tabId, scheduleFilter) {
  currentTab = tabId;
  const listTab = document.getElementById('listTab');
  const clientsTab = document.getElementById('clientsTab');
  const mapTab = document.getElementById('mapTab');
  const calendarTab = document.getElementById('calendarTab');
  const tabBtnList = document.getElementById('tabBtnList');
  const tabBtnClients = document.getElementById('tabBtnClients');
  const tabBtnMap = document.getElementById('tabBtnMap');
  const tabBtnCalendar = document.getElementById('tabBtnCalendar');

  const activeClasses = 'flex items-center justify-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all bg-white text-brand-600 shadow-xs border border-slate-200 whitespace-nowrap';
  const inactiveClasses = 'flex items-center justify-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 font-medium text-xs sm:text-sm rounded-xl transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 whitespace-nowrap';

  // 모든 탭 숨기기
  if (listTab) listTab.classList.add('hidden');
  if (clientsTab) clientsTab.classList.add('hidden');
  if (mapTab) mapTab.classList.add('hidden');
  if (calendarTab) calendarTab.classList.add('hidden');

  if (tabBtnList) tabBtnList.className = inactiveClasses;
  if (tabBtnClients) tabBtnClients.className = inactiveClasses;
  if (tabBtnMap) tabBtnMap.className = inactiveClasses;
  if (tabBtnCalendar) tabBtnCalendar.className = inactiveClasses;

  if (tabId === 'listTab') {
    if (listTab) listTab.classList.remove('hidden');
    if (tabBtnList) tabBtnList.className = activeClasses;
  } else if (tabId === 'clientsTab') {
    if (clientsTab) clientsTab.classList.remove('hidden');
    if (tabBtnClients) tabBtnClients.className = activeClasses;
    renderClientList();
  } else if (tabId === 'mapTab') {
    if (mapTab) mapTab.classList.remove('hidden');
    if (tabBtnMap) tabBtnMap.className = activeClasses;
    // 지도 인스턴스 렌더링 또는 리사이즈 처리
    initOrRefreshPropertyMap();
  } else if (tabId === 'calendarTab') {
    if (calendarTab) calendarTab.classList.remove('hidden');
    if (tabBtnCalendar) tabBtnCalendar.className = activeClasses;
    
    if (scheduleFilter) {
      filterScheduleType(scheduleFilter);
    }
    renderCalendarViews();
  }
  safeCreateIcons();
}

// ==========================================
// 8-1. 네이버 매물 지도 핀 연동 시스템 (인터랙티브 맵)
// ==========================================
let propertyMapInstance = null;
let propertyMarkersGroup = null;

const REGION_COORDINATES = {
  // 부평구
  '부평동': [37.4985, 126.7245],
  '부개동': [37.4965, 126.7380],
  '십정동': [37.4780, 126.7025],
  '삼산동': [37.5140, 126.7410],
  '갈산동': [37.5185, 126.7265],
  '청천동': [37.5180, 126.7090],
  '일신동': [37.4880, 126.7450],
  '산곡동': [37.5050, 126.7110],

  // 계양구
  '작전동': [37.5285, 126.7235],
  '효성동': [37.5320, 126.7085],
  '계산동': [37.5405, 126.7260],
  '임학동': [37.5475, 126.7350],
  '박촌동': [37.5550, 126.7460],
  '방축동': [37.5590, 126.7370],
  '귤현동': [37.5670, 126.7475],
  '서운동': [37.5260, 126.7420],

  // 서구
  '가좌동': [37.4930, 126.6850],
  '공촌동': [37.5510, 126.6790],
  '검암동': [37.5660, 126.6740],
  '당하동': [37.5920, 126.6710],
  '마전동': [37.5990, 126.6630],
  '연희동': [37.5430, 126.6750],
  '심곡동': [37.5380, 126.6760],
  '청라동': [37.5340, 126.6540],

  // 남동구
  '간석동': [37.4640, 126.7080],
  '만수동': [37.4560, 126.7320],
  '구월동': [37.4510, 126.7030],
  '논현동': [37.4040, 126.7220],

  // 연수구
  '청학동': [37.4250, 126.6670],
  '송도동': [37.3940, 126.6520],
  '연수동': [37.4170, 126.6780],

  // 미추홀구
  '도화동': [37.4670, 126.6640],
  '주안동': [37.4620, 126.6820],
  '숭의동': [37.4630, 126.6530],
  '용현동': [37.4520, 126.6430],

  // 중구
  '중산동': [37.4920, 126.5490],

  // 부천시
  '괴안동': [37.4840, 126.8120],
  '오정동': [37.5270, 126.7920],
  '원미동': [37.4950, 126.7860],
  '심곡동': [37.4850, 126.7820],
  '심곡본동': [37.4810, 126.7830],
  '상동': [37.5040, 126.7530],
  '중동': [37.5010, 126.7640],

  // 서울시
  '신월동': [37.5250, 126.8390],
  '공항동': [37.5610, 126.8110]
};

function getCoordinatesForProperty(p) {
  let base = REGION_COORDINATES[p.regionDong];
  if (!base) {
    if (p.regionGu === '부평구') base = [37.4985, 126.7245];
    else if (p.regionGu === '계양구') base = [37.5350, 126.7250];
    else if (p.regionGu === '서구') base = [37.5450, 126.6750];
    else if (p.regionGu === '남동구') base = [37.4550, 126.7150];
    else if (p.regionGu === '미추홀구') base = [37.4620, 126.6650];
    else if (p.regionCity === '부천시') base = [37.4950, 126.7800];
    else if (p.regionCity === '서울시') base = [37.5350, 126.8250];
    else base = [37.4985, 126.7245];
  }

  // 지번 및 고유 ID 기반 자연스러운 위치 분산 오프셋
  let hash = 0;
  const str = (p.address || '') + (p.id || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 1000) - 500) * 0.000018;
  const lngOffset = ((Math.abs(hash >> 3) % 1000) - 500) * 0.000025;

  return [base[0] + latOffset, base[1] + lngOffset];
}

function createCustomPricePin(property) {
  let badgeColor = '#2563eb'; // 기본 블루 (빌라)
  if (property.type === '아파트') badgeColor = '#7c3aed'; // 보라 (아파트)
  else if (property.type === '오피스텔' || property.type === '근린생활시설') badgeColor = '#059669'; // 에메랄드 (오피/근생)

  // 가격 요약: 17500 -> 1.75억, 9200 -> 9,200만, 22000 -> 2.2억
  let priceShort = '';
  const dep = property.deposit || 0;
  if (dep >= 10000) {
    const eok = Math.floor(dep / 10000);
    const man = dep % 10000;
    priceShort = man > 0 ? `${(dep / 10000).toFixed(1)}억` : `${eok}억`;
  } else {
    priceShort = `${dep.toLocaleString()}만`;
  }

  const html = `
    <div class="custom-map-pin group cursor-pointer transition-transform hover:scale-115 active:scale-95" style="transform: translate(-50%, -100%);">
      <div style="background-color: ${badgeColor};" class="text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-md flex items-center space-x-1 whitespace-nowrap border-2 border-white">
        <span>${priceShort}</span>
      </div>
      <div class="w-2 h-2 mx-auto rotate-45 -mt-1 bg-white border-r border-b border-slate-300"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: html,
    iconSize: [60, 30],
    iconAnchor: [30, 28]
  });
}

function generatePropertyPopupContent(p) {
  const canView = checkCanViewContact(p);
  const naverSearchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(p.address)}`;

  return `
    <div class="p-2 max-w-[280px] font-sans space-y-2 text-slate-800">
      <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
        <span class="text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
          p.type === '아파트' ? 'bg-purple-100 text-purple-800' :
          p.type === '오피스텔' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
        }">${p.type}</span>
        <span class="text-xs font-black text-rose-600">${formatPrice(p.tradeType, p.deposit, p.monthlyRent)}</span>
      </div>

      <div>
        <h4 class="font-extrabold text-sm text-slate-900 leading-tight">${p.title}</h4>
        <p class="text-xs text-slate-600 mt-0.5">${p.address} ${p.dongHo}</p>
        <p class="text-[11px] text-slate-500 mt-0.5">${p.area || ''} • ${p.roomCount || ''}</p>
      </div>

      <div class="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px] space-y-1">
        <div class="text-slate-700"><strong>특징:</strong> ${p.features || '상태 양호'}</div>
        <div class="text-slate-500"><strong>담당:</strong> ${p.createdByName}</div>
        ${canView && p.contacts && p.contacts.privateMemo ? `
          <div class="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
            ${p.contacts.privateMemo}
          </div>
        ` : ''}
      </div>

      <div class="pt-1 flex items-center space-x-1.5">
        <button type="button" onclick="openEditModal('${p.id}')" class="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-1.5 px-2 rounded-lg text-center shadow-xs transition-colors flex items-center justify-center space-x-1">
          <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
          <span>매물설명 보기</span>
        </button>
        <a href="${naverSearchUrl}" target="_blank" rel="noopener noreferrer" class="bg-[#03C75A] hover:bg-[#02b350] text-white font-bold text-xs py-1.5 px-2.5 rounded-lg text-center shadow-xs transition-colors flex items-center justify-center space-x-0.5" title="네이버 지도 로드뷰/길찾기">
          <span class="font-black text-xs">N</span>
          <span>지도</span>
        </a>
      </div>
    </div>
  `;
}

function initOrRefreshPropertyMap() {
  if (typeof L === 'undefined') {
    console.warn('Leaflet 지도 라이브러리가 로드되지 않았습니다.');
    return;
  }

  const mapContainer = document.getElementById('naverPropertyMap');
  if (!mapContainer) return;

  if (!propertyMapInstance) {
    // 부평역 중심 기본 위치 [37.4985, 126.7245]
    propertyMapInstance = L.map('naverPropertyMap', {
      center: [37.4985, 126.7245],
      zoom: 13,
      zoomControl: true
    });

    // 고화질 한국 지도 타일 레이어 (OSM 한글 정밀 타일)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; 송현아부동산공인중개사사무소 &copy; OpenStreetMap'
    }).addTo(propertyMapInstance);

    propertyMarkersGroup = L.layerGroup().addTo(propertyMapInstance);
  }

  setTimeout(() => {
    if (propertyMapInstance) {
      propertyMapInstance.invalidateSize();
      renderMapPropertyPins();
    }
  }, 200);
}

function renderMapPropertyPins() {
  if (!propertyMapInstance || !propertyMarkersGroup) return;

  propertyMarkersGroup.clearLayers();
  const properties = getStoredProperties();
  let count = 0;

  properties.forEach(p => {
    // 상태 필터 적용 (진행중, 거래완료, 보류 등)
    if (currentStatusFilter !== 'ALL' && p.status !== currentStatusFilter) return;

    const coords = getCoordinatesForProperty(p);
    const pinIcon = createCustomPricePin(p);
    const popupHtml = generatePropertyPopupContent(p);

    const marker = L.marker(coords, { icon: pinIcon });
    marker.bindPopup(popupHtml, { maxWidth: 300, className: 'property-custom-popup' });
    
    // 마커 클릭 시 팝업 아이콘 재생성
    marker.on('click', () => {
      setTimeout(() => { safeCreateIcons(); }, 100);
    });

    propertyMarkersGroup.addLayer(marker);
    count++;
  });

  const countBadge = document.getElementById('mapVisibleCountBadge');
  if (countBadge) {
    countBadge.textContent = `${count}개 매물 핀 활성화`;
  }
  const totalMapBadge = document.getElementById('totalMapBadge');
  if (totalMapBadge) {
    totalMapBadge.textContent = count;
  }
}

function focusMapRegion(regionName) {
  if (!propertyMapInstance) return;

  const centers = {
    'ALL': { center: [37.5100, 126.7150], zoom: 12 },
    '송도동': { center: [37.3940, 126.6520], zoom: 14 },
    '연수구': { center: [37.4100, 126.6600], zoom: 14 },
    '부평구': { center: [37.4985, 126.7245], zoom: 14 },
    '계양구': { center: [37.5350, 126.7250], zoom: 14 },
    '서구': { center: [37.5500, 126.6750], zoom: 13 },
    '남동구': { center: [37.4580, 126.7150], zoom: 14 },
    '미추홀구': { center: [37.4620, 126.6650], zoom: 14 },
    '부천시': { center: [37.4950, 126.7750], zoom: 14 },
    '서울시': { center: [37.5450, 126.8250], zoom: 14 }
  };

  const target = centers[regionName] || centers['ALL'];
  propertyMapInstance.flyTo(target.center, target.zoom, { duration: 1.0 });

  // 버튼 스타일 업데이트
  document.querySelectorAll('.map-region-btn').forEach(btn => {
    if (btn.textContent.includes(regionName) || (regionName === 'ALL' && btn.textContent.includes('전체'))) {
      btn.className = 'map-region-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-900 text-white shadow-2xs';
    } else {
      btn.className = 'map-region-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700';
    }
  });
}

function openNaverMapExternal() {
  // 네이버 지도 부평/인천 기본 검색 링크
  window.open('https://map.naver.com/v5/search/%EC%9D%B8%EC%B2%9C%EA%B4%91%EC%97%AD%EC%8B%9C%20%EB%B6%80%ED%8F%89%EA%B5%AC', '_blank');
}

function filterStatus(status) {
  currentStatusFilter = status;
  updateStatusButtonStyles();
  renderPropertyList();
}

function handleTogglePropertyStatus(propertyId) {
  const properties = getStoredProperties();
  const p = properties.find(item => item.id === propertyId);
  if (!p) return;

  const canEdt = checkCanEdit(p);
  if (!canEdt) {
    alert('⛔ 다른 직원이 등록한 매물의 상태는 변경할 수 없습니다.');
    return;
  }

  const nextStatus = p.status === '거래완료' ? '진행중' : '거래완료';
  p.status = nextStatus;
  saveProperties(properties);
  refreshAll();
  alert(`매물 [${p.title}] 상태가 '${nextStatus}'(으)로 변경 정리되었습니다.`);
}

function setTradeTypeFilter(type) {
  const select = document.getElementById('filterTradeType');
  if (select) select.value = type;

  const btnAll = document.getElementById('quickTradeBtnAll');
  const btnRent = document.getElementById('quickTradeBtnRent');
  const btnBuy = document.getElementById('quickTradeBtnBuy');

  if (btnAll) btnAll.className = type === 'ALL' ? 'px-2 py-1.5 text-xs font-bold rounded-xl bg-slate-900 text-white shadow-2xs whitespace-nowrap' : 'px-2 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap';
  if (btnRent) btnRent.className = type === '임차' ? 'px-2 py-1.5 text-xs font-bold rounded-xl bg-emerald-700 text-white shadow-2xs whitespace-nowrap' : 'px-2 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 whitespace-nowrap';
  if (btnBuy) btnBuy.className = type === '매수' ? 'px-2 py-1.5 text-xs font-bold rounded-xl bg-purple-700 text-white shadow-2xs whitespace-nowrap' : 'px-2 py-1.5 text-xs font-semibold rounded-xl bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 whitespace-nowrap';

  renderPropertyList();
}

function linkPropertyToClient(propertyId) {
  const properties = getStoredProperties();
  const p = properties.find(item => item.id === propertyId);
  if (!p) return;

  const clientName = p.contacts?.clientName || '';
  const clientPhone = p.contacts?.clientPhone || '';
  const isSale = p.tradeType === '매매';
  const defaultType = isSale ? '매수(실거주)' : (p.tradeType === '전세' ? '임차(전세)' : '임차(월세)');

  openNewClientModal();
  document.getElementById('clientFormName').value = clientName || `${p.title} 손님`;
  document.getElementById('clientFormPhone').value = clientPhone || '';
  document.getElementById('clientFormType').value = defaultType;
  document.getElementById('clientFormStatus').value = p.status === '거래완료' ? '계약완료' : '상담중';
  document.getElementById('clientFormPreferredType').value = p.type || '';
  document.getElementById('clientFormPreferredRegion').value = `${p.regionCity} ${p.regionGu || ''} ${p.regionDong || ''}`.trim();
  document.getElementById('clientFormBudget').value = formatPrice(p.tradeType, p.deposit, p.monthlyRent).replace(/<[^>]*>?/gm, '');
  document.getElementById('clientFormRecommendedProps').value = `${p.title} ${p.dongHo}`;
  document.getElementById('clientFormMemo').value = `[${p.title}] 매물장 등록 고객 (${p.tradeType} ${p.area || ''})`;

  document.getElementById('clientModalTitle').textContent = `[${p.title}] 고객장에 ${isSale ? '매수고객' : '임차고객'} 등록`;
}

// ==========================================
// 9. 매물 목록 렌더링 (PC 테이블 & 모바일 전용 카드 뷰)
// ==========================================
function renderPropertyList() {
  const properties = getStoredProperties();
  const tbody = document.getElementById('propertyTableBody');
  const mobileList = document.getElementById('mobilePropertyList');
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const tradeTypeFilter = document.getElementById('filterTradeType').value;

  const filtered = properties.filter(p => {
    const matchCity = currentCityFilter === 'ALL' || (p.regionCity || '인천시') === currentCityFilter;
    const matchGu = currentCityFilter !== '인천시' || currentGuFilter === 'ALL' || p.regionGu === currentGuFilter;
    const matchDong = currentCityFilter !== '인천시' || currentDongFilter === 'ALL' || p.regionDong === currentDongFilter;
    const matchStatus = currentStatusFilter === 'ALL' || p.status === currentStatusFilter;
    
    let matchTrade = true;
    if (tradeTypeFilter === '임차') {
      matchTrade = p.tradeType === '월세' || p.tradeType === '전세' || p.tradeType === '단기임대';
    } else if (tradeTypeFilter === '매수') {
      matchTrade = p.tradeType === '매매';
    } else if (tradeTypeFilter !== 'ALL') {
      matchTrade = p.tradeType === tradeTypeFilter;
    }

    const matchSearch = !search || 
      p.title.toLowerCase().includes(search) || 
      p.address.toLowerCase().includes(search) || 
      p.dongHo.toLowerCase().includes(search) || 
      p.type.toLowerCase().includes(search) ||
      (p.regionGu && p.regionGu.toLowerCase().includes(search)) ||
      (p.regionDong && p.regionDong.toLowerCase().includes(search)) ||
      (p.features && p.features.toLowerCase().includes(search));

    return matchCity && matchGu && matchDong && matchStatus && matchTrade && matchSearch;
  });

  document.getElementById('totalPropertiesBadge').textContent = filtered.length;
  const totalMapBadge = document.getElementById('totalMapBadge');
  if (totalMapBadge) totalMapBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    const emptyMsg = `
      <div class="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 p-6">
        <i data-lucide="map-pin-off" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
        <p class="text-sm font-semibold">선택하신 조건에 등록된 매물이 없습니다.</p>
      </div>
    `;
    tbody.innerHTML = `<tr><td colspan="10" class="py-12 text-center text-slate-400">조건에 맞는 매물이 없습니다.</td></tr>`;
    if (mobileList) mobileList.innerHTML = emptyMsg;
    safeCreateIcons();
    return;
  }

  // 1. PC 데스크톱 테이블 렌더링
  tbody.innerHTML = filtered.map((p, idx) => {
    const canView = checkCanViewContact(p);
    const canDel = checkCanDelete(p);
    const canEdt = checkCanEdit(p);
    const photos = p.photos || [];
    const isCompleted = p.status === '거래완료';

    let regionBadge = '';
    if (p.regionCity === '인천시') {
      regionBadge = `<span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 mr-1 mb-1">인천 ${p.regionGu || ''} ${p.regionDong || ''}</span>`;
    } else if (p.regionCity === '부천시') {
      regionBadge = `<span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 mr-1 mb-1">부천시</span>`;
    } else if (p.regionCity === '서울시') {
      regionBadge = `<span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 mr-1 mb-1">서울시</span>`;
    } else {
      regionBadge = `<span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mr-1 mb-1">그외</span>`;
    }

    const isSale = p.tradeType === '매매';
    const clientRoleLabel = isSale ? '매수고객' : '임차고객';
    const clientRoleBadge = isSale ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    const ownerRoleLabel = isSale ? '매도인' : '임대인';

    let contactHtml = '';
    if (canView) {
      contactHtml = `
        <div class="space-y-1">
          <div class="flex items-center space-x-1">
            <span class="text-[10px] ${clientRoleBadge} px-1.5 py-0.2 rounded font-bold">${clientRoleLabel}</span>
            <span class="font-semibold text-slate-900">${p.contacts.clientName || '미입력'}</span>
            <a href="tel:${p.contacts.clientPhone}" class="text-brand-600 hover:underline font-mono text-xs font-semibold ml-1">${p.contacts.clientPhone || '-'}</a>
            ${(p.contacts.clientName || p.contacts.clientPhone) ? `
              <button type="button" onclick="linkPropertyToClient('${p.id}')" class="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 shrink-0 whitespace-nowrap" title="고객장에 ${clientRoleLabel}으로 연동 정리">
                + 고객장
              </button>
            ` : ''}
          </div>
          <div class="flex items-center space-x-1">
            <span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">${ownerRoleLabel}</span>
            <span class="text-slate-700">${p.contacts.ownerName || '미입력'}</span>
            <span class="text-slate-600 font-mono text-[11px] ml-1">${p.contacts.ownerPhone || '-'}</span>
          </div>
          ${p.contacts.privateMemo ? `<div class="text-[10px] text-amber-800 bg-amber-50 p-1 rounded border border-amber-200">🔒 ${p.contacts.privateMemo}</div>` : ''}
        </div>
      `;
    } else {
      contactHtml = `
        <div class="bg-rose-50 border border-rose-200 rounded-lg p-2 text-center">
          <div class="flex items-center justify-center space-x-1 text-rose-700 font-bold text-xs">
            <i data-lucide="lock" class="w-3.5 h-3.5"></i>
            <span>연락처 비공개</span>
          </div>
          <p class="text-[10px] text-rose-600 mt-0.5">담당: <strong>${p.createdByName}</strong></p>
        </div>
      `;
    }

    const sched = p.schedules || {};
    let scheduleBadges = [];
    if (sched.meeting && sched.meeting.date) scheduleBadges.push(`<span class="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded mr-1 mb-1">미팅 ${formatScheduleDate(sched.meeting.date)}</span>`);
    if (sched.contract && sched.contract.date) scheduleBadges.push(`<span class="inline-flex items-center text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded mr-1 mb-1">계약 ${formatScheduleDate(sched.contract.date)}</span>`);
    if (sched.balance && sched.balance.date) scheduleBadges.push(`<span class="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded mr-1 mb-1">잔금 ${formatScheduleDate(sched.balance.date)}</span>`);
    if (sched.reminder && sched.reminder.date) scheduleBadges.push(`<span class="inline-flex items-center text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded mr-1 mb-1 font-bold">🔔 ${formatScheduleDate(sched.reminder.date)}</span>`);
    if (scheduleBadges.length === 0) scheduleBadges.push(`<span class="text-[11px] text-slate-400">일정 없음</span>`);

    let photoBtnHtml = photos.length > 0 ? `
      <button onclick="openPhotoGallery('${p.id}')" class="group flex flex-col items-center justify-center p-1 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all">
        <div class="w-12 h-10 rounded overflow-hidden bg-slate-100 relative">
          <img src="${photos[0].url}" alt="사진" class="w-full h-full object-cover group-hover:scale-105 transition-transform">
          <span class="absolute bottom-0.5 right-0.5 bg-black/70 text-[9px] font-bold text-white px-1 rounded">${photos.length}장</span>
        </div>
        <span class="text-[10px] font-semibold text-emerald-700 mt-1">광고 활용</span>
      </button>
    ` : `
      <button onclick="openEditModal('${p.id}')" class="text-[10px] text-slate-400 hover:text-emerald-600 flex flex-col items-center">
        <i data-lucide="image-plus" class="w-4 h-4 text-slate-300 mb-0.5"></i>
        <span>사진 추가</span>
      </button>
    `;

    const statusBadge = isCompleted 
      ? `<span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">🏁 거래완료</span>`
      : p.status === '보류'
      ? `<span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">⏸️ 보류</span>`
      : `<span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">🟢 진행중</span>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors ${isCompleted ? 'bg-slate-50/60 opacity-80' : ''}">
        <td class="py-3 px-3 text-center font-mono text-[11px] text-slate-500">${idx + 1}</td>
        <td class="py-3 px-3">
          <div class="mb-1">${statusBadge}</div>
          <span class="inline-block text-[11px] font-bold px-1.5 py-0.2 rounded ${
            p.tradeType === '매매' ? 'bg-indigo-100 text-indigo-800' :
            p.tradeType === '전세' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
          }">${p.tradeType}</span>
          <span class="text-[11px] text-slate-500 ml-1">${p.type}</span>
        </td>
        <td class="py-3 px-4">
          <div class="mb-1">${regionBadge}</div>
          <div class="font-bold text-slate-900 text-sm hover:text-brand-600 cursor-pointer flex items-center space-x-1" onclick="openEditModal('${p.id}')">
            <span>${p.title}</span>
            ${isCompleted ? '<span class="text-[11px] text-slate-400 font-normal">(계약완료)</span>' : ''}
          </div>
          <div class="text-xs text-slate-600 mt-0.5 flex items-center space-x-1">
            <i data-lucide="map-pin" class="w-3 h-3 text-slate-400 shrink-0"></i>
            <span>${p.address} <strong>${p.dongHo}</strong></span>
          </div>
          ${p.features ? `<div class="text-[10px] text-slate-400 mt-0.5">${p.features}</div>` : ''}
        </td>
        <td class="py-3 px-3">
          ${formatPrice(p.tradeType, p.deposit, p.monthlyRent)}
          <div class="text-[10px] text-slate-400 mt-0.5">관리비 ${p.maintenanceFee || 0}만</div>
        </td>
        <td class="py-3 px-3 text-slate-600 text-[11px]">
          <div>${p.area || '-'}</div>
          <div>${p.floor || '-'} / ${p.roomCount || '-'}</div>
        </td>
        <td class="py-3 px-3 text-center">${photoBtnHtml}</td>
        <td class="py-3 px-4 bg-slate-50/80 border-x border-slate-200">${contactHtml}</td>
        <td class="py-3 px-3"><div class="flex flex-wrap max-w-[190px]">${scheduleBadges.join('')}</div></td>
        <td class="py-3 px-3 text-xs">
          <span class="font-medium text-slate-800">${p.createdByName}</span>
          <div class="text-[10px] text-slate-400">${p.createdAt}</div>
        </td>
        <td class="py-3 px-3 text-center">
          <div class="flex flex-col space-y-1 items-center justify-center">
            ${canEdt ? `<button onclick="handleTogglePropertyStatus('${p.id}')" class="text-[10px] font-bold px-2 py-1 rounded-md border ${isCompleted ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}">${isCompleted ? '진행중 복구' : '✓ 거래완료'}</button>` : ''}
            <div class="flex items-center space-x-1">
              <button onclick="openEditModal('${p.id}')" title="수정" class="p-1 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
              ${canDel ? `<button onclick="handleDeleteProperty('${p.id}')" title="삭제 (대표자 전용)" class="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : `<button disabled title="삭제 권한 없음" class="p-1 text-slate-300 cursor-not-allowed"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`}
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 2. 모바일 전용 터치 최적화 카드 렌더링 (스마트폰 환경)
  if (mobileList) {
    mobileList.innerHTML = filtered.map(p => {
      const canView = checkCanViewContact(p);
      const canDel = checkCanDelete(p);
      const canEdt = checkCanEdit(p);
      const photos = p.photos || [];
      const isCompleted = p.status === '거래완료';

      let regBadge = '';
      if (p.regionCity === '인천시') {
        regBadge = `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">인천 ${p.regionGu || ''} ${p.regionDong || ''}</span>`;
      } else if (p.regionCity === '부천시') {
        regBadge = `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">부천시</span>`;
      } else if (p.regionCity === '서울시') {
        regBadge = `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">서울시</span>`;
      } else {
        regBadge = `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">그외</span>`;
      }

      const isSale = p.tradeType === '매매';
      const clientRoleLabel = isSale ? '매수고객' : '임차고객';
      const clientRoleBadge = isSale ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      const ownerRoleLabel = isSale ? '매도인' : '임대인';

      let contactBlock = '';
      if (canView) {
        contactBlock = `
          <div class="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1">
                <span class="text-[10px] font-bold ${clientRoleBadge} px-1 rounded">${clientRoleLabel}</span>
                <span class="font-bold text-slate-900">${p.contacts.clientName || '미입력'}</span>
                <span class="text-slate-600 font-mono text-[11px] ml-1">${p.contacts.clientPhone || ''}</span>
              </div>
              <div class="flex items-center space-x-1">
                ${(p.contacts.clientName || p.contacts.clientPhone) ? `
                  <button type="button" onclick="linkPropertyToClient('${p.id}')" class="text-[10px] font-bold bg-blue-100 text-blue-800 hover:bg-blue-200 px-1.5 py-0.5 rounded border border-blue-300 whitespace-nowrap">
                    고객장
                  </button>
                ` : ''}
                ${p.contacts.clientPhone ? `<a href="tel:${p.contacts.clientPhone}" class="inline-flex items-center space-x-0.5 text-[11px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-md shadow-xs active:bg-blue-700 whitespace-nowrap"><i data-lucide="phone-call" class="w-3 h-3"></i><span>통화</span></a>` : ''}
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-1">
                <span class="text-[10px] font-bold bg-amber-200 text-amber-900 px-1 rounded">${ownerRoleLabel}</span>
                <span class="text-slate-800 font-medium">${p.contacts.ownerName || '미입력'}</span>
                <span class="text-slate-500 font-mono text-[11px] ml-1">${p.contacts.ownerPhone || ''}</span>
              </div>
              ${p.contacts.ownerPhone ? `<a href="tel:${p.contacts.ownerPhone}" class="inline-flex items-center space-x-0.5 text-[11px] font-medium bg-slate-700 text-white px-2 py-0.5 rounded-md active:bg-slate-800 whitespace-nowrap"><i data-lucide="phone" class="w-3 h-3"></i><span>통화</span></a>` : ''}
            </div>
            ${p.contacts.privateMemo ? `<div class="text-[10px] text-amber-900 pt-1 border-t border-amber-200/60">🔒 ${p.contacts.privateMemo}</div>` : ''}
          </div>
        `;
      } else {
        contactBlock = `
          <div class="bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-center justify-between text-xs">
            <div class="flex items-center space-x-1 text-rose-700 font-bold">
              <i data-lucide="lock" class="w-3.5 h-3.5"></i>
              <span>고객 연락처 비공개</span>
            </div>
            <span class="text-[11px] text-rose-600 font-medium">담당: ${p.createdByName}</span>
          </div>
        `;
      }

      return `
        <div class="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-2.5 ${isCompleted ? 'opacity-70 bg-slate-50' : ''}">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5 flex-wrap">
              ${regBadge}
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${
                p.tradeType === '매매' ? 'bg-indigo-100 text-indigo-800' :
                p.tradeType === '전세' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
              }">${p.tradeType}</span>
              <span class="text-[10px] text-slate-500">${p.type}</span>
            </div>
            <div>${isCompleted ? '<span class="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">🏁 거래완료</span>' : '<span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">🟢 진행중</span>'}</div>
          </div>

          <div>
            <div class="flex items-center justify-between" onclick="openEditModal('${p.id}')">
              <h4 class="font-extrabold text-slate-900 text-sm hover:text-brand-600 cursor-pointer">${p.title}</h4>
              <div class="text-xs font-extrabold text-brand-700">${formatPrice(p.tradeType, p.deposit, p.monthlyRent)}</div>
            </div>
            <div class="text-xs text-slate-600 mt-0.5 flex items-center space-x-1">
              <i data-lucide="map-pin" class="w-3 h-3 text-slate-400 shrink-0"></i>
              <span>${p.address} <strong>${p.dongHo}</strong></span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              ${p.area || '-'} • ${p.floor || '-'} • ${p.roomCount || '-'} (관리비 ${p.maintenanceFee || 0}만)
            </div>
          </div>

          ${photos.length > 0 ? `
            <div class="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div class="flex items-center space-x-2 cursor-pointer" onclick="openPhotoGallery('${p.id}')">
                <img src="${photos[0].url}" alt="사진" class="w-10 h-7 rounded object-cover shadow-2xs">
                <span class="text-[11px] font-bold text-slate-700">현장 사진 ${photos.length}장</span>
              </div>
              <button onclick="openPhotoGallery('${p.id}')" class="text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded">
                광고 다운로드
              </button>
            </div>
          ` : ''}

          ${contactBlock}

          <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span class="text-[10px] text-slate-400">담당: ${p.createdByName}</span>
            <div class="flex items-center space-x-1.5">
              ${canEdt ? `<button onclick="handleTogglePropertyStatus('${p.id}')" class="px-2 py-1 text-[11px] font-bold rounded border ${isCompleted ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-700'}">${isCompleted ? '진행중 복구' : '거래완료'}</button>` : ''}
              <button onclick="openEditModal('${p.id}')" class="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700">수정</button>
              ${canDel ? `<button onclick="handleDeleteProperty('${p.id}')" class="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded">삭제</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  safeCreateIcons();
}

// ==========================================
// 10. 스마트 일정표 (월별 그림 달력 & 타임라인)
// ==========================================
function switchCalendarView(mode) {
  calendarViewMode = mode;
  const monthContainer = document.getElementById('monthlyCalendarContainer');
  const timelineContainer = document.getElementById('timelineContainer');
  const viewBtnMonth = document.getElementById('viewBtnMonth');
  const viewBtnTimeline = document.getElementById('viewBtnTimeline');

  if (mode === 'MONTH') {
    monthContainer.classList.remove('hidden');
    timelineContainer.classList.add('hidden');
    viewBtnMonth.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-brand-600 shadow-xs';
    viewBtnTimeline.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900';
    renderMonthlyCalendar();
  } else {
    monthContainer.classList.add('hidden');
    timelineContainer.classList.remove('hidden');
    viewBtnTimeline.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-brand-600 shadow-xs';
    viewBtnMonth.className = 'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900';
    renderTimelineAndReminderList();
  }
  safeCreateIcons();
}

function changeMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  } else if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  renderMonthlyCalendar();
}

function goTodayMonth() {
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  renderMonthlyCalendar();
}

function renderMonthlyCalendar() {
  const grid = document.getElementById('monthlyGridDays');
  const title = document.getElementById('calendarMonthTitle');
  title.textContent = `${calYear}년 ${calMonth + 1}월`;

  const properties = getStoredProperties();
  const allEvents = extractAllScheduleEvents(properties);

  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(calYear, calMonth, 0).getDate();

  const today = new Date();
  const isCurrentYearMonth = today.getFullYear() === calYear && today.getMonth() === calMonth;
  const todayDate = today.getDate();

  let cellsHtml = '';

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDate = prevMonthTotalDays - i;
    cellsHtml += `
      <div class="bg-slate-50/50 border border-slate-100 rounded-xl p-2 min-h-[95px] opacity-40">
        <span class="text-xs font-medium text-slate-400">${prevDate}</span>
      </div>
    `;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = (firstDayIndex + day - 1) % 7;
    const isToday = isCurrentYearMonth && day === todayDate;

    const dayEvents = allEvents.filter(ev => {
      const matchDate = ev.date && ev.date.startsWith(dateStr);
      const matchType = scheduleFilterType === 'ALL' || ev.scheduleType === scheduleFilterType;
      return matchDate && matchType;
    });

    let dateClass = 'text-slate-800';
    if (dayOfWeek === 0) dateClass = 'text-rose-500 font-bold';
    if (dayOfWeek === 6) dateClass = 'text-blue-600 font-bold';

    let eventsHtml = dayEvents.slice(0, 3).map(ev => {
      const colorMap = {
        MEETING: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
        CONTRACT: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
        SIGNING: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
        BALANCE: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
        EXPIRY: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
        REMINDER: 'bg-rose-100 text-rose-800 hover:bg-rose-200'
      }[ev.scheduleType] || 'bg-slate-100 text-slate-700';

      const timeText = ev.date.includes('T') ? ev.date.split('T')[1].substring(0, 5) : '';

      return `
        <div onclick="openEditModal('${ev.propertyId}')" title="${ev.typeName}: ${ev.propertyTitle} (${ev.memo || ''})" class="cursor-pointer text-[10px] font-semibold px-1.5 py-0.5 rounded truncate ${colorMap} transition-colors mb-1 flex items-center justify-between">
          <span class="truncate">[${ev.typeName}] ${ev.propertyTitle}</span>
          ${timeText ? `<span class="text-[9px] opacity-75 shrink-0 ml-0.5 font-mono">${timeText}</span>` : ''}
        </div>
      `;
    }).join('');

    if (dayEvents.length > 3) {
      eventsHtml += `<div class="text-[9px] font-bold text-slate-500 text-center">+${dayEvents.length - 3}건 더보기</div>`;
    }

    cellsHtml += `
      <div class="bg-white border ${isToday ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200'} hover:border-brand-300 rounded-xl p-1.5 sm:p-2 min-h-[95px] flex flex-col justify-between transition-all">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold ${dateClass} ${isToday ? 'bg-brand-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : ''}">${day}</span>
            ${dayEvents.length > 0 ? `<span class="text-[10px] font-bold text-slate-400">${dayEvents.length}건</span>` : ''}
          </div>
          <div class="space-y-0.5">
            ${eventsHtml}
          </div>
        </div>
      </div>
    `;
  }

  grid.innerHTML = cellsHtml;
  safeCreateIcons();
}

function extractAllScheduleEvents(properties) {
  let list = [];
  properties.forEach(p => {
    const s = p.schedules || {};
    const canView = checkCanViewContact(p);

    const typeConfigs = [
      { key: 'meeting', type: 'MEETING', name: '미팅', icon: 'users', color: 'blue' },
      { key: 'contract', type: 'CONTRACT', name: '계약일', icon: 'file-check-2', color: 'purple' },
      { key: 'signing', type: 'SIGNING', name: '계약서작성', icon: 'pen-tool', color: 'indigo' },
      { key: 'balance', type: 'BALANCE', name: '잔금일', icon: 'badge-dollar-sign', color: 'emerald' },
      { key: 'expiry', type: 'EXPIRY', name: '현재만기일', icon: 'calendar-clock', color: 'amber' },
      { key: 'reminder', type: 'REMINDER', name: '재확인', icon: 'bell-ring', color: 'rose' }
    ];

    typeConfigs.forEach(cfg => {
      const item = s[cfg.key];
      if (item && item.date) {
        list.push({
          propertyId: p.id,
          propertyTitle: p.title,
          propertyAddress: `${p.address} ${p.dongHo}`,
          tradeType: p.tradeType,
          createdByName: p.createdByName,
          createdById: p.createdById,
          canViewContact: canView,
          clientName: canView ? p.contacts.clientName : '🔒 비공개',
          clientPhone: canView ? p.contacts.clientPhone : '🔒 번호 비공개',
          ownerName: canView ? p.contacts.ownerName : '🔒 비공개',
          ownerPhone: canView ? p.contacts.ownerPhone : '🔒 번호 비공개',
          scheduleType: cfg.type,
          typeName: cfg.name,
          icon: cfg.icon,
          color: cfg.color,
          date: item.date,
          memo: item.memo,
          dday: calculateDDay(item.date)
        });
      }
    });
  });

  // 고객장(CRM)에 등록된 차기 미팅 및 투어 일정 자동 연동
  try {
    const clients = getStoredClients();
    clients.forEach(c => {
      if (c.nextMeeting && c.nextMeeting.date) {
        const canView = checkCanViewClientContact(c);
        list.push({
          propertyId: c.id,
          propertyTitle: `[고객미팅] ${c.name} (${c.type})`,
          propertyAddress: c.preferredRegion || c.preferredType || '현장 미팅',
          tradeType: c.type,
          createdByName: c.createdByName || '유수정 (대표자)',
          createdById: c.createdById || 'user_admin',
          canViewContact: canView,
          clientName: canView ? c.name : '🔒 비공개',
          clientPhone: canView ? c.phone : '🔒 번호 비공개',
          ownerName: '-',
          ownerPhone: '-',
          scheduleType: 'MEETING',
          typeName: '고객미팅',
          icon: 'users',
          color: 'blue',
          date: c.nextMeeting.date,
          memo: c.nextMeeting.memo || c.memo || '',
          dday: calculateDDay(c.nextMeeting.date),
          isClientMeeting: true,
          clientId: c.id
        });
      }
    });
  } catch (err) {
    console.warn('고객 미팅 일정 연동 오류:', err);
  }

  return list;
}

function renderTimelineAndReminderList() {
  const properties = getStoredProperties();
  const timelineContainer = document.getElementById('scheduleTimelineList');
  const reminderContainer = document.getElementById('reminderBoardList');
  const allEvents = extractAllScheduleEvents(properties);

  allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  const filtered = scheduleFilterType === 'ALL' 
    ? allEvents 
    : allEvents.filter(s => s.scheduleType === scheduleFilterType);

  if (filtered.length === 0) {
    timelineContainer.innerHTML = `
      <div class="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
        <i data-lucide="calendar-x" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
        <p class="text-xs">해당 분류의 일정이 없습니다.</p>
      </div>
    `;
  } else {
    timelineContainer.innerHTML = filtered.map(item => {
      return `
        <div class="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start space-x-3 transition-all hover:border-brand-300 hover:shadow-xs">
          <div class="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <i data-lucide="${item.icon}" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="text-xs font-bold text-slate-900">[${item.typeName}] ${item.propertyTitle}</span>
                <span class="text-[10px] text-slate-500">${item.propertyAddress}</span>
              </div>
              ${item.dday ? `<span class="text-[10px] px-2 py-0.5 rounded-full ${item.dday.cls}">${item.dday.text}</span>` : ''}
            </div>
            <div class="text-xs text-slate-600 mt-1 font-medium flex items-center space-x-1">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>일시: <strong>${formatScheduleDate(item.date)}</strong></span>
            </div>
            ${item.memo ? `<div class="mt-1 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">📝 ${item.memo}</div>` : ''}
            <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span class="text-slate-500">담당: ${item.createdByName} | 고객: ${item.clientName} (${item.clientPhone})</span>
              <button onclick="openEditModal('${item.propertyId}')" class="text-brand-600 hover:underline font-bold">매물 상세 &rarr;</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  const immediateReminders = allEvents.filter(s => s.scheduleType === 'REMINDER' || s.scheduleType === 'EXPIRY');
  if (immediateReminders.length === 0) {
    reminderContainer.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">예정된 알림이 없습니다.</div>`;
  } else {
    reminderContainer.innerHTML = immediateReminders.map(rem => {
      const isReminder = rem.scheduleType === 'REMINDER';
      return `
        <div class="p-3 rounded-lg border ${isReminder ? 'border-rose-200 bg-rose-50/50' : 'border-amber-200 bg-amber-50/50'} text-xs mb-2">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold ${isReminder ? 'text-rose-700' : 'text-amber-800'}">[${rem.typeName}] ${rem.propertyTitle}</span>
            ${rem.dday ? `<span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${rem.dday.cls}">${rem.dday.text}</span>` : ''}
          </div>
          <div class="text-slate-600">${rem.memo || '예정된 알림'}</div>
          <div class="mt-2 pt-1 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-500">
            <span>예정일: ${formatScheduleDate(rem.date)}</span>
            <button onclick="openEditModal('${rem.propertyId}')" class="text-brand-600 hover:underline font-bold">확인</button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderCalendarViews() {
  const properties = getStoredProperties();
  const allEvents = extractAllScheduleEvents(properties);

  let stats = { MEETING: 0, CONTRACT: 0, SIGNING: 0, BALANCE: 0, EXPIRY: 0, REMINDER: 0 };
  allEvents.forEach(e => {
    if (stats[e.scheduleType] !== undefined) stats[e.scheduleType]++;
  });

  document.getElementById('statMeetingCount').textContent = `${stats.MEETING}건`;
  document.getElementById('statContractCount').textContent = `${stats.CONTRACT}건`;
  document.getElementById('statSigningCount').textContent = `${stats.SIGNING}건`;
  document.getElementById('statBalanceCount').textContent = `${stats.BALANCE}건`;
  document.getElementById('statExpiryCount').textContent = `${stats.EXPIRY}건`;
  document.getElementById('statReminderCount').textContent = `${stats.REMINDER}건`;
  document.getElementById('totalSchedulesBadge').textContent = allEvents.length;

  if (calendarViewMode === 'MONTH') {
    renderMonthlyCalendar();
  } else {
    renderTimelineAndReminderList();
  }
}

function filterScheduleType(type) {
  scheduleFilterType = type;
  document.querySelectorAll('.schedule-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-type') === type) {
      btn.className = 'schedule-filter-btn px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-white shadow-xs';
    } else {
      btn.className = 'schedule-filter-btn px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200';
    }
  });
  renderCalendarViews();
}

// ==========================================
// 11. 임장 사진 핸들러
// ==========================================
async function handlePhotoSelect(e) {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const compressedDataUrl = await compressImage(file, 900, 0.75);
      uploadedPhotos.push({
        id: 'ph_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: compressedDataUrl
      });
    } catch (err) {
      console.error('이미지 압축 실패:', err);
    }
  }

  e.target.value = '';
  renderPhotoPreviews();
}

function renderPhotoPreviews() {
  const container = document.getElementById('photoPreviewContainer');
  const notice = document.getElementById('photoCountNotice');
  notice.textContent = `등록된 사진: ${uploadedPhotos.length}장`;

  if (uploadedPhotos.length === 0) {
    container.innerHTML = `<div class="col-span-full text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">등록된 임장 현장 사진이 없습니다.</div>`;
    return;
  }

  container.innerHTML = uploadedPhotos.map((photo, index) => {
    return `
      <div class="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video">
        <img src="${photo.url}" alt="${photo.name}" class="w-full h-full object-cover">
        <button type="button" onclick="deleteUploadedPhoto(${index})" class="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 opacity-90 group-hover:opacity-100 shadow">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
        <span class="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate text-center">${photo.name}</span>
      </div>
    `;
  }).join('');

  safeCreateIcons();
}

function deleteUploadedPhoto(index) {
  uploadedPhotos.splice(index, 1);
  renderPhotoPreviews();
}

function openPhotoGallery(propertyId) {
  const properties = getStoredProperties();
  const p = properties.find(item => item.id === propertyId);
  if (!p || !p.photos || p.photos.length === 0) {
    alert('등록된 임장 사진이 없습니다.');
    return;
  }

  currentGalleryProperty = p;
  currentGalleryIndex = 0;

  document.getElementById('galleryModalTitle').textContent = `[${p.title}] 임장 현장 사진 갤러리`;
  document.getElementById('galleryPropertyAddress').textContent = `소재지: ${p.address} ${p.dongHo} (${p.regionCity} ${p.regionGu || ''})`;
  
  renderGalleryViewer();

  const modal = document.getElementById('photoGalleryModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  safeCreateIcons();
}

function renderGalleryViewer() {
  if (!currentGalleryProperty || !currentGalleryProperty.photos) return;
  const photos = currentGalleryProperty.photos;
  const activePhoto = photos[currentGalleryIndex] || photos[0];

  document.getElementById('galleryMainImage').src = activePhoto.url;
  document.getElementById('galleryPhotoTotalCount').textContent = photos.length;

  const downloadBtn = document.getElementById('galleryDownloadBtn');
  downloadBtn.href = activePhoto.url;
  downloadBtn.download = `${currentGalleryProperty.title}_${activePhoto.name || '현장사진'}.jpg`;

  const strip = document.getElementById('galleryThumbnailsStrip');
  strip.innerHTML = photos.map((ph, idx) => {
    const isSelected = idx === currentGalleryIndex;
    return `
      <div onclick="selectGalleryPhoto(${idx})" class="cursor-pointer aspect-video rounded-lg overflow-hidden border-2 ${isSelected ? 'border-brand-600 ring-2 ring-brand-500/30' : 'border-transparent opacity-60 hover:opacity-100'} transition-all">
        <img src="${ph.url}" alt="${ph.name}" class="w-full h-full object-cover">
      </div>
    `;
  }).join('');

  safeCreateIcons();
}

function selectGalleryPhoto(index) {
  currentGalleryIndex = index;
  renderGalleryViewer();
}

function closeGalleryModal() {
  const modal = document.getElementById('photoGalleryModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// ==========================================
// 12. 매물 등록 / 수정 / 저장 (새 이름 유수정, 이은숙, 황규문 연동)
// ==========================================
function openNewPropertyModal() {
  document.getElementById('propertyForm').reset();
  document.getElementById('editPropertyId').value = '';
  document.getElementById('modalTitle').textContent = '신규 매물 접수 및 일정 동시 등록';
  document.getElementById('submitBtnText').textContent = '접수 및 일정 동시 저장';

  document.getElementById('formRegionCity').value = '인천시';
  handleModalCityChange();
  document.getElementById('formRegionGu').value = '부평구';
  handleModalGuChange();

  uploadedPhotos = [];
  renderPhotoPreviews();

  document.getElementById('formClientPhone').disabled = false;
  document.getElementById('formOwnerPhone').disabled = false;

  const roleSelect = document.getElementById('formClientRoleType');
  if (roleSelect) roleSelect.value = 'AUTO';
  const autoReg = document.getElementById('formAutoRegisterClient');
  if (autoReg) autoReg.checked = true;

  // 실시간 면적 계산기 초기화
  const m2El = document.getElementById('calcAreaM2');
  const pyEl = document.getElementById('calcAreaPy');
  if (m2El) m2El.value = '';
  if (pyEl) pyEl.value = '';

  const modal = document.getElementById('propertyModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  safeCreateIcons();
}

function openEditModal(propertyId) {
  const properties = getStoredProperties();
  const p = properties.find(item => item.id === propertyId);
  if (!p) return;

  const canEdt = checkCanEdit(p);
  const canView = checkCanViewContact(p);

  document.getElementById('editPropertyId').value = p.id;
  document.getElementById('modalTitle').textContent = `매물 정보 및 일정 수정 - ${p.title} (${p.id})`;
  document.getElementById('submitBtnText').textContent = '변경사항 저장';

  const city = p.regionCity || '인천시';
  document.getElementById('formRegionCity').value = city;
  handleModalCityChange();

  if (city === '인천시') {
    document.getElementById('formRegionGu').value = p.regionGu || '부평구';
    handleModalGuChange();
    if (p.regionDong) {
      document.getElementById('formRegionDong').value = p.regionDong;
    }
  }

  document.getElementById('formType').value = p.type || '아파트';
  document.getElementById('formTradeType').value = p.tradeType || '월세';
  document.getElementById('formTitle').value = p.title || '';
  document.getElementById('formAddress').value = p.address || '';
  document.getElementById('formDongHo').value = p.dongHo || '';
  document.getElementById('formDeposit').value = p.deposit || 0;
  document.getElementById('formMonthlyRent').value = p.monthlyRent || 0;
  document.getElementById('formMaintenanceFee').value = p.maintenanceFee || 0;
  document.getElementById('formArea').value = p.area || '';
  
  // 기존 면적 텍스트에서 ㎡와 평수 추출하여 계산기 인풋에 반영
  const m2El = document.getElementById('calcAreaM2');
  const pyEl = document.getElementById('calcAreaPy');
  if (m2El && pyEl) {
    const areaStr = p.area || '';
    const m2Match = areaStr.match(/([\d.]+)\s*㎡/);
    const pyMatch = areaStr.match(/([\d.]+)\s*평/);
    m2El.value = m2Match ? m2Match[1] : '';
    pyEl.value = pyMatch ? pyMatch[1] : '';
  }
  document.getElementById('formFloor').value = p.floor || '';
  document.getElementById('formRoomCount').value = p.roomCount || '';
  document.getElementById('formFeatures').value = p.features || '';
  document.getElementById('formPublicMemo').value = p.publicMemo || '';

  uploadedPhotos = p.photos ? [...p.photos] : [];
  renderPhotoPreviews();

  if (canView) {
    document.getElementById('formClientName').value = p.contacts?.clientName || '';
    document.getElementById('formClientPhone').value = p.contacts?.clientPhone || '';
    document.getElementById('formOwnerName').value = p.contacts?.ownerName || '';
    document.getElementById('formOwnerPhone').value = p.contacts?.ownerPhone || '';
    document.getElementById('formPrivateMemo').value = p.contacts?.privateMemo || '';
    document.getElementById('formClientPhone').disabled = false;
    document.getElementById('formOwnerPhone').disabled = false;

    const roleSelect = document.getElementById('formClientRoleType');
    if (roleSelect) {
      roleSelect.value = p.tradeType === '매매' ? '매수' : '임차';
    }
  } else {
    document.getElementById('formClientName').value = '🔒 비공개 (담당: ' + p.createdByName + ')';
    document.getElementById('formClientPhone').value = '***-****-****';
    document.getElementById('formOwnerName').value = '🔒 비공개';
    document.getElementById('formOwnerPhone').value = '***-****-****';
    document.getElementById('formPrivateMemo').value = '🔒 비밀 메모 열람 권한이 없습니다.';
    document.getElementById('formClientPhone').disabled = true;
    document.getElementById('formOwnerPhone').disabled = true;
  }

  const s = p.schedules || {};
  document.getElementById('schedMeeting').value = s.meeting?.date || '';
  document.getElementById('schedMeetingMemo').value = s.meeting?.memo || '';
  document.getElementById('schedContract').value = s.contract?.date || '';
  document.getElementById('schedContractMemo').value = s.contract?.memo || '';
  document.getElementById('schedSigning').value = s.signing?.date || '';
  document.getElementById('schedSigningMemo').value = s.signing?.memo || '';
  document.getElementById('schedBalance').value = s.balance?.date || '';
  document.getElementById('schedBalanceMemo').value = s.balance?.memo || '';
  document.getElementById('schedExpiry').value = s.expiry?.date || '';
  document.getElementById('schedExpiryMemo').value = s.expiry?.memo || '';
  document.getElementById('schedReminder').value = s.reminder?.date || '';
  document.getElementById('schedReminderMemo').value = s.reminder?.memo || '';

  const modal = document.getElementById('propertyModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  safeCreateIcons();
}

function closeModal() {
  const modal = document.getElementById('propertyModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function handleSaveProperty(e) {
  e.preventDefault();
  const properties = getStoredProperties();
  const editId = document.getElementById('editPropertyId').value;
  const user = USERS[currentUserKey] || USERS.admin;

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let targetProperty = null;

  if (editId) {
    targetProperty = properties.find(p => p.id === editId);
    if (!targetProperty) return;

    if (!checkCanEdit(targetProperty)) {
      alert('다른 직원의 매물은 수정 권한이 없습니다.');
      return;
    }
  } else {
    targetProperty = {
      id: 'P-' + Math.floor(100 + Math.random() * 900),
      createdById: user.id,
      createdByName: `${user.name} (${user.title})`,
      createdAt: dateStr,
      status: '진행중'
    };
  }

  const city = document.getElementById('formRegionCity').value;
  targetProperty.regionCity = city;
  if (city === '인천시') {
    targetProperty.regionGu = document.getElementById('formRegionGu').value;
    targetProperty.regionDong = document.getElementById('formRegionDong').value;
  } else {
    targetProperty.regionGu = '';
    targetProperty.regionDong = '';
  }

  targetProperty.type = document.getElementById('formType').value;
  targetProperty.tradeType = document.getElementById('formTradeType').value;
  targetProperty.title = document.getElementById('formTitle').value.trim();
  targetProperty.address = document.getElementById('formAddress').value.trim();
  targetProperty.dongHo = document.getElementById('formDongHo').value.trim();
  targetProperty.deposit = Number(document.getElementById('formDeposit').value) || 0;
  targetProperty.monthlyRent = Number(document.getElementById('formMonthlyRent').value) || 0;
  targetProperty.maintenanceFee = Number(document.getElementById('formMaintenanceFee').value) || 0;
  targetProperty.area = document.getElementById('formArea').value.trim();
  targetProperty.floor = document.getElementById('formFloor').value.trim();
  targetProperty.roomCount = document.getElementById('formRoomCount').value.trim();
  targetProperty.features = document.getElementById('formFeatures').value.trim();
  targetProperty.publicMemo = document.getElementById('formPublicMemo').value.trim();

  targetProperty.photos = [...uploadedPhotos];

  if (!editId || checkCanViewContact(targetProperty)) {
    targetProperty.contacts = {
      clientName: document.getElementById('formClientName').value.trim(),
      clientPhone: document.getElementById('formClientPhone').value.trim(),
      ownerName: document.getElementById('formOwnerName').value.trim(),
      ownerPhone: document.getElementById('formOwnerPhone').value.trim(),
      privateMemo: document.getElementById('formPrivateMemo').value.trim()
    };
  }

  targetProperty.schedules = {
    meeting: { date: document.getElementById('schedMeeting').value, memo: document.getElementById('schedMeetingMemo').value.trim() },
    contract: { date: document.getElementById('schedContract').value, memo: document.getElementById('schedContractMemo').value.trim() },
    signing: { date: document.getElementById('schedSigning').value, memo: document.getElementById('schedSigningMemo').value.trim() },
    balance: { date: document.getElementById('schedBalance').value, memo: document.getElementById('schedBalanceMemo').value.trim() },
    expiry: { date: document.getElementById('schedExpiry').value, memo: document.getElementById('schedExpiryMemo').value.trim() },
    reminder: { date: document.getElementById('schedReminder').value, memo: document.getElementById('schedReminderMemo').value.trim() }
  };

  if (!editId) {
    properties.unshift(targetProperty);
  }

  saveProperties(properties);

  // 고객장(CRM) 임차·매수 고객 자동 등록 및 연계
  const autoRegister = document.getElementById('formAutoRegisterClient')?.checked;
  const clientRoleSelect = document.getElementById('formClientRoleType')?.value || 'AUTO';
  const clientNameVal = document.getElementById('formClientName')?.value?.trim();
  const clientPhoneVal = document.getElementById('formClientPhone')?.value?.trim();

  if (autoRegister && (clientNameVal || clientPhoneVal)) {
    try {
      let clients = getStoredClients();
      let determinedRole = '임차(월세)';
      if (clientRoleSelect === '매수' || (clientRoleSelect === 'AUTO' && targetProperty.tradeType === '매매')) {
        determinedRole = (targetProperty.type === '토지/건물' || targetProperty.type === '상가/사무실') ? '매수(투자)' : '매수(실거주)';
      } else if (clientRoleSelect === '임차' || clientRoleSelect === 'AUTO') {
        determinedRole = targetProperty.tradeType === '전세' ? '임차(전세)' : '임차(월세)';
      }

      const existingIdx = clients.findIndex(c => (clientPhoneVal && c.phone === clientPhoneVal) || (clientNameVal && c.name === clientNameVal));
      if (existingIdx >= 0) {
        const ex = clients[existingIdx];
        if (!ex.recommendedProps || !ex.recommendedProps.includes(targetProperty.title)) {
          ex.recommendedProps = ex.recommendedProps ? `${ex.recommendedProps}, ${targetProperty.title}` : targetProperty.title;
        }
      } else {
        const newClient = {
          id: 'C-' + Date.now(),
          name: clientNameVal || `${targetProperty.title} 손님`,
          phone: clientPhoneVal || '번호미입력',
          type: determinedRole,
          status: '상담중',
          preferredType: targetProperty.type,
          preferredRegion: `${targetProperty.regionCity} ${targetProperty.regionGu || ''} ${targetProperty.regionDong || ''}`.trim(),
          budget: formatPrice(targetProperty.tradeType, targetProperty.deposit, targetProperty.monthlyRent).replace(/<[^>]*>?/gm, ''),
          moveInDate: '협의',
          recommendedProps: `${targetProperty.title} ${targetProperty.dongHo}`,
          nextMeeting: { date: targetProperty.schedules?.meeting?.date || '', memo: targetProperty.schedules?.meeting?.memo || '' },
          memo: `[매물장 자동연동] ${targetProperty.title} ${targetProperty.tradeType} 의뢰 고객`,
          createdById: user.id,
          createdByName: `${user.name} (${user.title})`,
          createdAt: dateStr
        };
        clients.unshift(newClient);
      }
      saveClients(clients);
      const clientBadge = document.getElementById('totalClientsBadge');
      if (clientBadge) clientBadge.textContent = clients.length;
    } catch (err) {
      console.error('고객 자동 연동 실패:', err);
    }
  }

  closeModal();
  refreshAll();

  const msg = editId 
    ? '매물 정보, 사진 및 일정이 성공적으로 수정되었습니다.' 
    : '매물 접수가 완료되었습니다! 인천/부천/서울 지역과 6대 스마트 일정이 저장되었습니다.';
  alert(msg);
}

function handleDeleteProperty(propertyId) {
  const user = USERS[currentUserKey] || USERS.admin;
  if (user.role !== 'ADMIN') {
    alert('⛔ 매물 삭제 권한이 없습니다!\n매물 삭제는 오직 유수정 대표자만 처리할 수 있습니다.');
    return;
  }

  if (confirm('정말로 이 매물을 영구 삭제하시겠습니까?\n삭제된 매물과 등록된 일정, 현장 사진은 복구할 수 없습니다.')) {
    let properties = getStoredProperties();
    properties = properties.filter(p => p.id !== propertyId);
    saveProperties(properties);
    refreshAll();
    alert('매물이 안전하게 삭제되었습니다.');
  }
}

// ==========================================
// 12-1. 임차·매수 고객장 (CRM) 엔진
// ==========================================
let currentClientTypeFilter = 'ALL';

function filterClientsByType(type) {
  currentClientTypeFilter = type;
  document.querySelectorAll('.client-type-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-type') === type) {
      btn.className = 'client-type-filter-btn px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-900 text-white shadow-2xs';
    } else {
      btn.className = 'client-type-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700';
    }
  });
  renderClientList();
}

function filterClientsByMeeting() {
  currentClientTypeFilter = 'MEETING';
  document.querySelectorAll('.client-type-filter-btn').forEach(btn => {
    btn.className = 'client-type-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700';
  });
  renderClientList();
}

function filterClientsByActive() {
  currentClientTypeFilter = 'ACTIVE';
  document.querySelectorAll('.client-type-filter-btn').forEach(btn => {
    btn.className = 'client-type-filter-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700';
  });
  renderClientList();
}

function renderClientList() {
  const tableBody = document.getElementById('clientTableBody');
  const mobileList = document.getElementById('mobileClientList');
  if (!tableBody || !mobileList) return;

  const clients = getStoredClients();

  // 통계 집계
  const totalCount = clients.length;
  const rentCount = clients.filter(c => c.type && c.type.includes('임차')).length;
  const buyCount = clients.filter(c => c.type && c.type.includes('매수')).length;
  const commCount = clients.filter(c => c.type && (c.type.includes('상가') || c.type.includes('사무실'))).length;
  const meetingCount = clients.filter(c => c.nextMeeting && c.nextMeeting.date).length;
  const activeCount = clients.filter(c => c.status === '상담중' || c.status === '투어예정').length;

  const statTotalEl = document.getElementById('statClientTotal');
  const statRentEl = document.getElementById('statClientRent');
  const statBuyEl = document.getElementById('statClientBuy');
  const statCommEl = document.getElementById('statClientCommercial');
  const statMeetingEl = document.getElementById('statClientMeeting');
  const statActiveEl = document.getElementById('statClientActive');
  const badgeEl = document.getElementById('totalClientsBadge');

  if (statTotalEl) statTotalEl.textContent = `${totalCount}명`;
  if (statRentEl) statRentEl.textContent = `${rentCount}명`;
  if (statBuyEl) statBuyEl.textContent = `${buyCount}명`;
  if (statCommEl) statCommEl.textContent = `${commCount}명`;
  if (statMeetingEl) statMeetingEl.textContent = `${meetingCount}명`;
  if (statActiveEl) statActiveEl.textContent = `${activeCount}명`;
  if (badgeEl) badgeEl.textContent = totalCount;

  // 필터링 적용
  const searchInput = document.getElementById('clientSearchInput');
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const statusSelect = document.getElementById('filterClientStatusSelect');
  const statusFilter = statusSelect ? statusSelect.value : 'ALL';

  let filtered = clients.filter(c => {
    // 1. 유형 필터
    if (currentClientTypeFilter === '임차' && (!c.type || !c.type.includes('임차'))) return false;
    if (currentClientTypeFilter === '매수' && (!c.type || !c.type.includes('매수'))) return false;
    if (currentClientTypeFilter === '상가' && (!c.type || (!c.type.includes('상가') && !c.type.includes('사무실')))) return false;
    if (currentClientTypeFilter === 'MEETING' && (!c.nextMeeting || !c.nextMeeting.date)) return false;
    if (currentClientTypeFilter === 'ACTIVE' && c.status !== '상담중' && c.status !== '투어예정') return false;

    // 2. 상태 필터
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;

    // 3. 검색어 필터
    if (searchTerm) {
      const matchName = (c.name || '').toLowerCase().includes(searchTerm);
      const matchPhone = (c.phone || '').toLowerCase().includes(searchTerm);
      const matchType = (c.type || '').toLowerCase().includes(searchTerm);
      const matchPrefType = (c.preferredType || '').toLowerCase().includes(searchTerm);
      const matchRegion = (c.preferredRegion || '').toLowerCase().includes(searchTerm);
      const matchBudget = (c.budget || '').toLowerCase().includes(searchTerm);
      const matchProps = (c.recommendedProps || '').toLowerCase().includes(searchTerm);
      const matchMemo = (c.memo || '').toLowerCase().includes(searchTerm);
      if (!matchName && !matchPhone && !matchType && !matchPrefType && !matchRegion && !matchBudget && !matchProps && !matchMemo) {
        return false;
      }
    }
    return true;
  });

  // 빈 결과 뷰
  if (filtered.length === 0) {
    const emptyHtml = `
      <tr>
        <td colspan="9" class="py-12 text-center text-slate-400">
          <i data-lucide="user-x" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
          <p class="text-sm font-semibold text-slate-600">조건에 일치하는 고객이 없습니다.</p>
          <button type="button" onclick="openNewClientModal()" class="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-blue-700">
            <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
            <span>새 고객 등록하기</span>
          </button>
        </td>
      </tr>
    `;
    tableBody.innerHTML = emptyHtml;
    mobileList.innerHTML = `
      <div class="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
        <i data-lucide="user-x" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
        <p class="text-sm font-semibold text-slate-600">조건에 일치하는 고객이 없습니다.</p>
        <button type="button" onclick="openNewClientModal()" class="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-blue-700">
          <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
          <span>새 고객 등록하기</span>
        </button>
      </div>
    `;
    safeCreateIcons();
    return;
  }

  // 데스크톱 테이블 렌더링
  tableBody.innerHTML = filtered.map((c, idx) => {
    const canView = checkCanViewClientContact(c);
    const canDel = checkCanDeleteClient(c);
    const canEdt = checkCanEditClient(c);

    // 유형 배지
    let typeBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
    if (c.type && c.type.includes('임차')) typeBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (c.type && c.type.includes('매수')) typeBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
    else if (c.type && (c.type.includes('상가') || c.type.includes('사무실'))) typeBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';

    // 상태 배지
    let statusBadgeClass = 'bg-slate-100 text-slate-700';
    if (c.status === '투어예정') statusBadgeClass = 'bg-blue-100 text-blue-800 font-bold';
    else if (c.status === '상담중') statusBadgeClass = 'bg-emerald-100 text-emerald-800 font-semibold';
    else if (c.status === '계약완료') statusBadgeClass = 'bg-slate-800 text-white font-bold';
    else if (c.status === '보류') statusBadgeClass = 'bg-rose-50 text-rose-600 border border-rose-200';

    // 미팅 일정 포맷팅
    let meetingHtml = '<span class="text-slate-400 text-[11px]">-</span>';
    if (c.nextMeeting && c.nextMeeting.date) {
      const dday = calculateDDay(c.nextMeeting.date);
      let ddayBadge = '';
      if (dday.diffDays === 0) ddayBadge = '<span class="bg-rose-500 text-white px-1.5 py-0.2 rounded text-[10px] font-black animate-pulse">오늘</span>';
      else if (dday.diffDays > 0 && dday.diffDays <= 3) ddayBadge = `<span class="bg-amber-500 text-white px-1.5 py-0.2 rounded text-[10px] font-bold">D-${dday.diffDays}</span>`;
      else if (dday.diffDays > 3) ddayBadge = `<span class="bg-blue-500 text-white px-1.5 py-0.2 rounded text-[10px] font-bold">D-${dday.diffDays}</span>`;
      else ddayBadge = `<span class="bg-slate-400 text-white px-1.5 py-0.2 rounded text-[10px]">지남</span>`;

      const formattedDate = c.nextMeeting.date.replace('T', ' ');
      meetingHtml = `
        <div class="space-y-1">
          <div class="flex items-center space-x-1">
            ${ddayBadge}
            <span class="text-xs font-bold text-slate-800">${formattedDate}</span>
          </div>
          ${c.nextMeeting.memo ? `<div class="text-[11px] text-blue-700 truncate" title="${c.nextMeeting.memo}">📍 ${c.nextMeeting.memo}</div>` : ''}
        </div>
      `;
    }

    // 연락처 열람 권한
    let contactHtml = '';
    if (canView) {
      contactHtml = `
        <div class="space-y-1">
          <div class="font-bold text-slate-900 text-xs">${c.name}</div>
          <div class="flex items-center space-x-1.5">
            <span class="text-xs font-medium text-slate-700 tracking-tight">${c.phone}</span>
            <a href="tel:${c.phone}" class="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors" title="전화걸기">
              <i data-lucide="phone" class="w-3 h-3"></i>
            </a>
            <a href="sms:${c.phone}" class="p-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors" title="문자보내기">
              <i data-lucide="message-square" class="w-3 h-3"></i>
            </a>
          </div>
        </div>
      `;
    } else {
      contactHtml = `
        <div class="space-y-1 opacity-75">
          <div class="font-bold text-slate-700 text-xs">${c.name}</div>
          <div class="flex items-center space-x-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
            <i data-lucide="lock" class="w-3 h-3 text-amber-600 shrink-0"></i>
            <span>010-****-**** (비공개)</span>
          </div>
        </div>
      `;
    }

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">${idx + 1}</td>
        <td class="py-3 px-3">
          <div class="space-y-1">
            <span class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${typeBadgeClass}">${c.type || '일반'}</span>
            <div><span class="inline-block text-[10px] px-1.5 py-0.2 rounded ${statusBadgeClass}">${c.status}</span></div>
          </div>
        </td>
        <td class="py-3 px-4 bg-slate-50/50 border-x border-slate-200">
          ${contactHtml}
        </td>
        <td class="py-3 px-4">
          <div class="space-y-0.5 text-xs">
            <div class="font-bold text-slate-900">${c.preferredRegion || '지역 무관'} <span class="text-slate-500 font-normal">(${c.preferredType || '유형 무관'})</span></div>
            <div class="text-rose-600 font-bold">${c.budget || '예산 협의'}</div>
            ${c.moveInDate ? `<div class="text-[11px] text-slate-500">입주희망: ${c.moveInDate}</div>` : ''}
          </div>
        </td>
        <td class="py-3 px-4">
          <div class="text-xs text-slate-800 line-clamp-2" title="${c.recommendedProps || ''}">
            ${c.recommendedProps ? `<span class="bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded border border-brand-200 font-medium">${c.recommendedProps}</span>` : '<span class="text-slate-400">-</span>'}
          </div>
        </td>
        <td class="py-3 px-3">
          ${meetingHtml}
        </td>
        <td class="py-3 px-4">
          <div class="text-xs text-slate-600 line-clamp-2 max-w-xs" title="${c.memo || ''}">${c.memo || '-'}</div>
        </td>
        <td class="py-3 px-3">
          <span class="text-[11px] font-medium text-slate-600">${c.createdByName ? c.createdByName.split(' ')[0] : '직원'}</span>
        </td>
        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center space-x-1">
            ${canEdt ? `
              <button type="button" onclick="openEditClientModal('${c.id}')" class="p-1.5 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="고객 수정">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
            ${canDel ? `
              <button type="button" onclick="handleDeleteClient('${c.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="고객 삭제">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 모바일 카드 렌더링
  mobileList.innerHTML = filtered.map((c, idx) => {
    const canView = checkCanViewClientContact(c);
    const canDel = checkCanDeleteClient(c);
    const canEdt = checkCanEditClient(c);

    let typeBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
    if (c.type && c.type.includes('임차')) typeBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (c.type && c.type.includes('매수')) typeBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
    else if (c.type && (c.type.includes('상가') || c.type.includes('사무실'))) typeBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';

    let statusBadgeClass = 'bg-slate-100 text-slate-700';
    if (c.status === '투어예정') statusBadgeClass = 'bg-blue-100 text-blue-800 font-bold';
    else if (c.status === '상담중') statusBadgeClass = 'bg-emerald-100 text-emerald-800 font-semibold';
    else if (c.status === '계약완료') statusBadgeClass = 'bg-slate-800 text-white font-bold';
    else if (c.status === '보류') statusBadgeClass = 'bg-rose-50 text-rose-600 border border-rose-200';

    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${typeBadgeClass}">${c.type || '일반'}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded ${statusBadgeClass}">${c.status}</span>
          </div>
          <div class="flex items-center space-x-1">
            ${canEdt ? `
              <button type="button" onclick="openEditClientModal('${c.id}')" class="p-1.5 text-slate-500 hover:text-brand-600 rounded-lg">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
            ` : ''}
            ${canDel ? `
              <button type="button" onclick="handleDeleteClient('${c.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <div>
          <div class="text-base font-bold text-slate-900">${c.name}</div>
          ${canView ? `
            <div class="flex items-center space-x-2 mt-1">
              <span class="text-xs font-semibold text-slate-700 tracking-tight">${c.phone}</span>
              <a href="tel:${c.phone}" class="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center space-x-1">
                <i data-lucide="phone" class="w-3 h-3"></i>
                <span>전화</span>
              </a>
              <a href="sms:${c.phone}" class="px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center space-x-1">
                <i data-lucide="message-square" class="w-3 h-3"></i>
                <span>문자</span>
              </a>
            </div>
          ` : `
            <div class="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center space-x-1 mt-1">
              <i data-lucide="lock" class="w-3 h-3 text-amber-600"></i>
              <span>010-****-**** (비공개 보호)</span>
            </div>
          `}
        </div>

        <div class="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 text-slate-700">
          <div><span class="font-bold text-slate-900">희망조건:</span> ${c.preferredRegion || '-'} / ${c.preferredType || '-'}</div>
          <div><span class="font-bold text-slate-900">희망예산:</span> <span class="text-rose-600 font-bold">${c.budget || '-'}</span></div>
          ${c.moveInDate ? `<div><span class="font-bold text-slate-900">입주시점:</span> ${c.moveInDate}</div>` : ''}
          ${c.recommendedProps ? `<div><span class="font-bold text-slate-900">추천매물:</span> <span class="text-brand-700 font-medium">${c.recommendedProps}</span></div>` : ''}
        </div>

        ${c.nextMeeting && c.nextMeeting.date ? `
          <div class="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-900 flex items-center justify-between">
            <div class="flex items-center space-x-1.5">
              <i data-lucide="calendar" class="w-4 h-4 text-blue-600"></i>
              <span class="font-bold">${c.nextMeeting.date.replace('T', ' ')}</span>
            </div>
            ${c.nextMeeting.memo ? `<span class="text-[11px] text-blue-700 truncate max-w-[150px]">${c.nextMeeting.memo}</span>` : ''}
          </div>
        ` : ''}

        ${c.memo ? `
          <div class="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl p-2.5">
            <span class="font-bold text-slate-800">메모:</span> ${c.memo}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  safeCreateIcons();
}

function openNewClientModal() {
  document.getElementById('clientFormId').value = '';
  document.getElementById('clientFormName').value = '';
  document.getElementById('clientFormPhone').value = '';
  document.getElementById('clientFormType').value = '임차(월세)';
  document.getElementById('clientFormStatus').value = '상담중';
  document.getElementById('clientFormPreferredType').value = '';
  document.getElementById('clientFormPreferredRegion').value = '';
  document.getElementById('clientFormBudget').value = '';
  document.getElementById('clientFormMoveInDate').value = '';
  document.getElementById('clientFormRecommendedProps').value = '';
  document.getElementById('clientFormNextMeetingDate').value = '';
  document.getElementById('clientFormNextMeetingMemo').value = '';
  document.getElementById('clientFormMemo').value = '';

  document.getElementById('clientModalTitle').textContent = '신규 고객 등록 (임차·매수·상가)';
  document.getElementById('clientSubmitBtnText').textContent = '고객 저장하기';

  const modal = document.getElementById('clientModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  safeCreateIcons();
}

function openEditClientModal(id) {
  const clients = getStoredClients();
  const c = clients.find(item => item.id === id);
  if (!c) {
    alert('해당 고객 정보를 찾을 수 없습니다.');
    return;
  }

  document.getElementById('clientFormId').value = c.id;
  document.getElementById('clientFormName').value = c.name || '';
  document.getElementById('clientFormPhone').value = c.phone || '';
  document.getElementById('clientFormType').value = c.type || '임차(월세)';
  document.getElementById('clientFormStatus').value = c.status || '상담중';
  document.getElementById('clientFormPreferredType').value = c.preferredType || '';
  document.getElementById('clientFormPreferredRegion').value = c.preferredRegion || '';
  document.getElementById('clientFormBudget').value = c.budget || '';
  document.getElementById('clientFormMoveInDate').value = c.moveInDate || '';
  document.getElementById('clientFormRecommendedProps').value = c.recommendedProps || '';
  document.getElementById('clientFormNextMeetingDate').value = (c.nextMeeting && c.nextMeeting.date) ? c.nextMeeting.date : '';
  document.getElementById('clientFormNextMeetingMemo').value = (c.nextMeeting && c.nextMeeting.memo) ? c.nextMeeting.memo : '';
  document.getElementById('clientFormMemo').value = c.memo || '';

  document.getElementById('clientModalTitle').textContent = `고객 정보 및 상담 수정 - ${c.name}`;
  document.getElementById('clientSubmitBtnText').textContent = '변경사항 저장';

  const modal = document.getElementById('clientModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  safeCreateIcons();
}

function closeClientModal() {
  const modal = document.getElementById('clientModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function handleSaveClient(event) {
  event.preventDefault();

  const id = document.getElementById('clientFormId').value;
  const name = document.getElementById('clientFormName').value.trim();
  const phone = document.getElementById('clientFormPhone').value.trim();
  const type = document.getElementById('clientFormType').value;
  const status = document.getElementById('clientFormStatus').value;
  const preferredType = document.getElementById('clientFormPreferredType').value.trim();
  const preferredRegion = document.getElementById('clientFormPreferredRegion').value.trim();
  const budget = document.getElementById('clientFormBudget').value.trim();
  const moveInDate = document.getElementById('clientFormMoveInDate').value.trim();
  const recommendedProps = document.getElementById('clientFormRecommendedProps').value.trim();
  const nextMeetingDate = document.getElementById('clientFormNextMeetingDate').value;
  const nextMeetingMemo = document.getElementById('clientFormNextMeetingMemo').value.trim();
  const memo = document.getElementById('clientFormMemo').value.trim();

  if (!name || !phone) {
    alert('고객명과 연락처는 필수 입력 항목입니다.');
    return;
  }

  let clients = getStoredClients();
  const user = USERS[currentUserKey] || USERS.admin;

  if (id) {
    // 수정
    const idx = clients.findIndex(c => c.id === id);
    if (idx !== -1) {
      clients[idx] = {
        ...clients[idx],
        name,
        phone,
        type,
        status,
        preferredType,
        preferredRegion,
        budget,
        moveInDate,
        recommendedProps,
        nextMeeting: {
          date: nextMeetingDate,
          memo: nextMeetingMemo
        },
        memo
      };
    }
  } else {
    // 신규 등록
    const newId = `C-2026-${String(Date.now()).slice(-4)}`;
    const newClient = {
      id: newId,
      name,
      phone,
      type,
      status,
      preferredType,
      preferredRegion,
      budget,
      moveInDate,
      recommendedProps,
      nextMeeting: {
        date: nextMeetingDate,
        memo: nextMeetingMemo
      },
      memo,
      createdById: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString().split('T')[0]
    };
    clients.unshift(newClient);
  }

  saveClients(clients);
  closeClientModal();
  refreshAll();
  alert(id ? '고객 정보가 안전하게 수정되었습니다.' : '새 고객이 등록되었습니다. 임차·매수 조건 및 일정이 저장되었습니다.');
}

function handleDeleteClient(id) {
  const user = USERS[currentUserKey] || USERS.admin;
  if (user.role !== 'ADMIN') {
    alert('⛔ 고객 정보 삭제 권한이 없습니다!\n고객 삭제는 오직 유수정 대표자만 처리할 수 있습니다.');
    return;
  }

  if (confirm('정말로 이 고객 정보를 삭제하시겠습니까?\n삭제된 상담 기록 및 미팅 일정은 복구할 수 없습니다.')) {
    let clients = getStoredClients();
    clients = clients.filter(c => c.id !== id);
    saveClients(clients);
    refreshAll();
    alert('고객 정보가 삭제되었습니다.');
  }
}

function refreshAll() {
  updateRoleBanner();
  renderPropertyList();
  renderClientList();
  renderCalendarViews();
  if (typeof renderMapPropertyPins === 'function') {
    renderMapPropertyPins();
  }
}

// ==========================================
// 13. DOM 로드 및 초기 이벤트 연결
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  currentUserKey = localStorage.getItem(LOGIN_STORAGE_KEY);
  if (!USERS[currentUserKey]) {
    currentUserKey = null;
  }

  initRegionControls();

  document.getElementById('openNewPropertyModalBtn').addEventListener('click', openNewPropertyModal);
  document.getElementById('searchInput').addEventListener('input', renderPropertyList);
  document.getElementById('filterTradeType').addEventListener('change', renderPropertyList);

  document.getElementById('propertyModal').addEventListener('click', (e) => {
    if (e.target.id === 'propertyModal') closeModal();
  });

  const clientModal = document.getElementById('clientModal');
  if (clientModal) {
    clientModal.addEventListener('click', (e) => {
      if (e.target.id === 'clientModal') closeClientModal();
    });
  }

  document.getElementById('photoGalleryModal').addEventListener('click', (e) => {
    if (e.target.id === 'photoGalleryModal') closeGalleryModal();
  });

  const loginModal = document.getElementById('loginModal');
  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target.id === 'loginModal') {
        if (!currentUserKey) {
          alert('송현아부동산 매물장 이용을 위해 비밀번호로 로그인해 주세요.');
          return;
        }
        closeLoginModal();
      }
    });
  }

  // 첫 방문 또는 미로그인 상태 시 로그인 모달 자동 오픈
  if (!currentUserKey) {
    openLoginModal(true);
  }

  refreshAll();

  // 중앙 서버(server.js) 실행 중일 경우 최신 매물 및 고객 데이터 자동 동기화
  Promise.all([fetchServerProperties(), fetchServerClients()]).then(() => {
    refreshAll();
  });
});

window.addEventListener('load', () => {
  safeCreateIcons();
});
