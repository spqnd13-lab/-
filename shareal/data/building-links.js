/**
 * 건물 → 층 → 호실 → 매물 연결표 (공개 파일)
 *
 * 기존 매물 ID와 도면 ID(P###)를 바꾸지 않고 참조만 합니다.
 * 자동 추측으로 호실과 매물을 잇지 않습니다. 확인된 연결만 units 에 적습니다.
 *
 * confidence:  확인됨 = 자료로 대조함 / 참고 = 도면에서 읽음 / 미확인 = 자료 없음
 * 개인정보(이름·전화·비공개 메모)는 넣지 않습니다. AGENTS.md 1항.
 */
window.BUILDING_LINKS = {
  version: '2026-11-20',
  buildings: [
    {
      buildingId: 'ait-center',
      name: '송도 AIT센터',
      aliases: ['AIT센터', 'AIT'],
      address: '인천광역시 연수구 송도과학로 80',
      image: 'images/building_ait_center.webp',
      floorsAboveGround: 27,
      summary: '지식산업센터·교육연구시설(101동)과 오피스텔(102동), 저층 근린생활시설로 이루어진 복합 건물입니다.',
      sourceRef: '20211214_AIT센터 도면_면적.pdf · AIT근린상가 첨부 평면도',
      verifiedAt: '2026-11-20',
      confidence: '확인됨',
      /**
       * 동 구분 근거 (2026-11-20 원본 대조)
       * 20211214_AIT센터 도면_면적.pdf 의 각 층 페이지에 두 동이 색으로 구분돼 있다.
       *   노랑 '지식산업센터 전용율 42.66%'   : 2~15층   → 101동
       *   보라 '교육연구시설'                : 18~27층  → 101동
       *   초록 '오피스텔 원룸/투룸 전용율'     : 5~27층   → 102동
       * 모델(P134~P143)의 호실 구획을 이 페이지에 겹치면 번호까지 일치한다.
       * 101동 = 지식산업센터·교육연구시설, 102동 = 오피스텔 (대표 확인과 일치).
       */
      wings: [
        { wingId: '101', name: '101동', usage: '지식산업센터 · 교육연구시설', confidence: '확인됨',
          note: '층별 페이지에 지식산업센터(노랑)·교육연구시설(보라)로 호실과 전용율이 표기돼 있습니다.' },
        { wingId: '102', name: '102동', usage: '오피스텔', confidence: '확인됨',
          note: '층별 페이지에 오피스텔(초록)로 호실과 전용율이 표기돼 있습니다.' }
      ],
      /**
       * 도면이 있는 층만 적습니다. 없는 층은 화면에서 '도면 준비 중'으로 보입니다.
       *
       * drawnWings = 그 층 도면 페이지에 **호실이 상세 표기된 동**.
       * 원본 PDF 10장을 색상으로 판별한 결과(2026-11-20):
       *   2~4층  : 지식산업센터(노랑)만 표기   → 101동
       *   5~17층 : 오피스텔(초록) 상세 표기    → 102동 (101동은 흐린 윤곽만)
       *   18~27층: 오피스텔(초록)만 표기      → 102동
       * 건물 구성(대표 확인): 1층 근린 / 2층 근린+지산 주차장 /
       *   3층 근린쪽 옥상정원+지산 주차장 / 4층 지산+주차장 /
       *   5층부터 101동(지산·교육연구)과 102동(오피스텔)이 따로 올라감.
       */
      floors: [
        { floorId: '1', label: '1층', plans: [{ planId: 'P146', usage: '근린생활시설' }], confidence: '참고' },
        { floorId: '2', label: '2층', plans: [{ planId: 'P134', usage: '지식산업센터' }], drawnWings: ['101'], confidence: '참고' },
        { floorId: '3', label: '3층', plans: [{ planId: 'P135', usage: '지식산업센터' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '4', label: '4층', plans: [{ planId: 'P136', usage: '지식산업센터' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '5', label: '5층', plans: [{ planId: 'P137', usage: '지식산업센터 · 오피스텔' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '6', label: '6층', plans: [{ planId: 'P138', usage: '지식산업센터 · 오피스텔' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '7', label: '7층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '8', label: '8층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '9', label: '9층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '10', label: '10층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '11', label: '11층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '12', label: '12층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '13', label: '13층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '14', label: '14층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '15', label: '15층', plans: [{ planId: 'P140', usage: '지식산업센터 · 오피스텔' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '16', label: '16층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '17', label: '17층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '18', label: '18층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '19', label: '19층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '20', label: '20층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '21', label: '21층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '22', label: '22층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '23', label: '23층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '24', label: '24층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '25', label: '25층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '26', label: '26층', plans: [{ planId: 'P142', usage: '교육연구시설 · 오피스텔' }], drawnWings: ['101', '102'], confidence: '참고' },
        { floorId: '27', label: '27층', plans: [{ planId: 'P143', usage: '교육연구시설 · 오피스텔' }], drawnWings: ['101', '102'], confidence: '참고' }
      ]
    }
  ],

  /**
   * 호실 ↔ 도면 ↔ 매물 연결. 대조해 확인한 것만 적습니다.
   * planUnitLabel: 묶음 평면은 대표층 번호로 표기돼 있어 호수와 다릅니다.
   *                (예: 11층 1107호 → 7층 기준 평면의 707)
   */
  units: [
    {
      buildingId: 'ait-center',
      floorId: '11',
      wingId: '101',
      unitId: '1107',
      planId: 'P139',
      planUnitLabel: '707',
      planUnitUsage: '지식산업센터',
      listingId: 'P-YSJ-25',

      // 매물 ↔ 호수: 매물 제목·주소에 '101동 1107호'가 그대로 적혀 있음
      listingConfidence: '확인됨',

      // 호수 ↔ 3D 구획: 원본 도면으로 확인함
      //  - PDF 6쪽(7~14층·16~17층)에 '지식산업센터 전용율 42.66%'(노랑)로
      //    701~713 이 표기돼 있고, 왼쪽에는 '오피스텔'(초록) 701~713 이 따로 있다.
      //  - 모델 P139 의 호실 구획을 이 페이지에 겹치면 두 무리 모두 번호까지 맞는다.
      //  - 11층 1107호는 101동이므로 지식산업센터 쪽 707 에 해당한다.
      planUnitConfidence: '확인됨',

      confidence: '확인됨',
      verifiedAt: '2026-11-20',
      sourceRef: '20211214_AIT센터 도면_면적.pdf 6쪽(7~14층·16~17층) 지식산업센터 표기 · 매물 동호수',
      note: '7~14층·16~17층은 한 장의 대표 평면을 쓰므로 도면 표기는 707 입니다.'
    }
  ]
};
