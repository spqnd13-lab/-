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
       * - 101동 = 지식산업센터·교육연구시설, 102동 = 오피스텔 : 대표 확인 (명칭 기준)
       * - 다만 20211214_AIT센터 도면_면적.pdf 의 각 층 페이지에는 **오피스텔 동 평면만**
       *   그려져 있다. P139(7~14층)는 701~713 오피스텔 13실, P141(18~25층)은
       *   1801~1813 오피스텔 13실이며 '오피스텔 전용률' 주석이 붙어 있다.
       * - 모델(P134~P143)이 들고 있는 지식산업센터·교육연구시설 호실은 이 PDF가 아닌
       *   다른 자료에서 온 것이라 이 도면 위 위치를 확인할 수 없다.
       */
      wings: [
        { wingId: '101', name: '101동', usage: '지식산업센터 · 교육연구시설', confidence: '미확인',
          note: '이 도면 자료에는 101동 평면이 없습니다. 도면 위 호실 위치를 확인하지 못했습니다.' },
        { wingId: '102', name: '102동', usage: '오피스텔', confidence: '확인됨',
          note: '층별 페이지에 오피스텔 호실 번호와 전용률이 인쇄돼 있습니다.' }
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
        { floorId: '2', label: '2층', plans: [{ planId: 'P147', usage: '근린생활시설' }, { planId: 'P134', usage: '지식산업센터' }], drawnWings: ['101'], confidence: '참고' },
        { floorId: '3', label: '3층', plans: [{ planId: 'P135', usage: '지식산업센터' }], drawnWings: ['101'], confidence: '참고' },
        { floorId: '4', label: '4층', plans: [{ planId: 'P136', usage: '지식산업센터' }], drawnWings: ['101'], confidence: '참고' },
        { floorId: '5', label: '5층', plans: [{ planId: 'P137', usage: '지식산업센터 · 오피스텔' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '6', label: '6층', plans: [{ planId: 'P138', usage: '지식산업센터 · 오피스텔' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '7', label: '7층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '8', label: '8층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '9', label: '9층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '10', label: '10층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '11', label: '11층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '12', label: '12층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '13', label: '13층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '14', label: '14층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '15', label: '15층', plans: [{ planId: 'P140', usage: '지식산업센터 · 오피스텔' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '16', label: '16층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '17', label: '17층', plans: [{ planId: 'P139', usage: '지식산업센터 · 오피스텔', note: '7~14층 · 16~17층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '18', label: '18층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '19', label: '19층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '20', label: '20층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '21', label: '21층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '22', label: '22층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '23', label: '23층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '24', label: '24층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '25', label: '25층', plans: [{ planId: 'P141', usage: '교육연구시설 · 오피스텔', note: '18~25층 대표 평면' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '26', label: '26층', plans: [{ planId: 'P142', usage: '교육연구시설 · 오피스텔' }], drawnWings: ['102'], confidence: '참고' },
        { floorId: '27', label: '27층', plans: [{ planId: 'P143', usage: '교육연구시설 · 오피스텔' }], drawnWings: ['102'], confidence: '참고' }
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

      // 호수 ↔ 3D 구획: 확인되지 않음.
      // P139 모델의 호실 구획을 원본 도면(PDF 6쪽)에 겹쳐 보면 인쇄된 호수와
      // 가로로 250~300px 일관되게 어긋난다. 모델이 만들어질 때 쓴 원본 이미지와
      // 지금 PDF에서 뽑은 이미지의 기준틀이 달라서로 보이며(sourceSHA256 불일치),
      // 같은 층에 707이 두 개(101동·102동) 있어 어느 쪽인지 확정할 수 없다.
      planUnitConfidence: '미확인',
      holdPlanLink: true,
      planLinkNote: '도면 구획과 호수의 대응을 아직 확인하지 못해 특정 호실 강조를 보류합니다. 층 도면만 보여 줍니다.',

      confidence: '참고',
      verifiedAt: '2026-11-20',
      sourceRef: '20211214_AIT센터 도면_면적.pdf 6쪽(7~14층·16~17층) · 매물 동호수',
      openQuestion: '모델 제작 당시의 원본 이미지 또는 정합 기준점이 있으면 확정 가능'
    }
  ]
};
