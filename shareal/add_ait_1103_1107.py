#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""AIT센터 102동 1103호(P-YSJ-24)·101동 1107호(P-YSJ-25) 매물장 신규 등록 + 캐시 키 V36 격상"""
import json, re, io, os

BASE = os.path.dirname(os.path.abspath(__file__))

def sched(expiry_date, expiry_memo, reminder_date, reminder_memo):
    return {
        "meeting": {"date": "", "memo": ""},
        "contract": {"date": "", "memo": ""},
        "signing": {"date": "", "memo": ""},
        "balance": {"date": "", "memo": ""},
        "expiry": {"date": expiry_date, "memo": expiry_memo},
        "reminder": {"date": reminder_date, "memo": reminder_memo},
    }

p24 = {
    "id": "P-YSJ-24",
    "regionCity": "인천시",
    "regionGu": "연수구",
    "regionDong": "송도동",
    "type": "오피스텔",
    "tradeType": "월세",
    "title": "송도 AIT센터 102동 1103호 (오피스텔)",
    "address": "인천광역시 연수구 송도과학로 80 (송도 AIT센터, 송도동 172-6)",
    "dongHo": "102동 1103호",
    "deposit": 1000,
    "monthlyRent": 85,
    "maintenanceFee": 8,
    "area": "전용 8.8평 (29.2㎡) / 공급 21.5평 (71.12㎡)",
    "floor": "11층 / 27층",
    "roomCount": "원룸 (오픈형) / 화장실 1",
    "features": "AIT센터 오피스텔, 채광 좋은 남동향, 부가세 별도, 2027년 1월 중순 입주협의",
    "publicMemo": "송도동 172-6 송도 AIT센터 102동 11층 오피스텔. 보증금 1,000만원 / 월세 85만원(부가세 별도). 전용 29.2㎡, 공급 71.12㎡, 11층/27층, 남동향, 월관리비 약 8만원, 지상27층·지하2층, 사용승인 2024.2.2. 만기 2027년 1월 중순 이후 입주 협의 가능.",
    "contacts": {
        "clientName": "",
        "clientPhone": "",
        "ownerName": "신재선",
        "ownerPhone": "010-3243-8294",
        "privateMemo": "102동 1103호(오피스텔). 임대인(대장 소유자) 신재선 010-3243-8294 / 주소: 인천광역시 강화군 강화읍 동문로152번길 50, 101동402호(용정빌리지) / 소유권이전 2024.3.12. 보증금 1,000만원 / 월세 85만원(부가세 별도), 만기 2027년 1월 중. 텐컴즈 매물번호 16410495229 (네이버등록안됨 보관, 미전송).\n[대장 실측] 전유 29.20㎡ / 공용 41.92㎡(주차장 19.06+공용 15.55+비계단공용 3.76+기타공용 3.55) / 계약 71.12㎡(21.5평). 지상 11층, 사용승인 2024.2.2, 건물ID 2220241574164846.\n[중복 확인] 텐컴즈·매물장에 102동 1103호 기등록 없음(102동 1509·2603호는 별도 호실).",
        "ownerAddress": "인천광역시 강화군 강화읍 동문로152번길 50, 101동402호 (용정빌리지)",
        "ownerIdNo": "751124-1******",
    },
    "status": "진행중",
    "createdById": "user_admin",
    "createdByName": "유수정 (대표자)",
    "createdAt": "2026-11-12",
    "photos": [
        "images/real_ait_1.jpg",
        "images/real_ait_2.jpg",
        "images/real_ait_3.jpg",
        "images/real_ait_4.jpg",
    ],
    "schedules": sched("2027-01-15", "AIT 102동 1103호 임대차 만기(2027년 1월 중)", "2026-12-15", "만기 1개월 전 — 재계약/신규 임차인 입주일 협의 확인"),
    "owner": "신재선",
}

p25 = {
    "id": "P-YSJ-25",
    "regionCity": "인천시",
    "regionGu": "연수구",
    "regionDong": "송도동",
    "type": "사무실",
    "tradeType": "월세",
    "title": "송도 AIT센터 101동 1107호 (소형사무실)",
    "address": "인천광역시 연수구 송도과학로 80 (송도 AIT센터, 송도동 172-6)",
    "dongHo": "101동 1107호",
    "deposit": 700,
    "monthlyRent": 70,
    "maintenanceFee": 12,
    "area": "전용 10.2평 (33.72㎡) / 계약 23.9평 (79.04㎡)",
    "floor": "11층 / 27층",
    "roomCount": "사무실 1실 / 화장실 1",
    "features": "AIT센터 11층 사무실, 싱크대 상하부장 완비, 양문형 강화도어, 데코타일·조명 최상, 보증금·월세 조정 가능",
    "publicMemo": "송도동 172-6 송도 AIT센터 101동 11층 사무실. 보증금 700만원 / 월세 70만원(조정 가능). 전용 33.72㎡(10.2평), 계약 79.04㎡, 11층/27층, 월관리비 약 12만원, 주차 299대(세대당 1.04대), 천장에어컨·중앙냉난방, 싱크대 상하부장 완비, 양문형 강화도어, 데코타일 바닥과 조명 최상 상태. 만기 2027년 4월 중순 이후 입주 협의.",
    "contacts": {
        "clientName": "",
        "clientPhone": "",
        "ownerName": "김상용",
        "ownerPhone": "",
        "privateMemo": "101동 1107호(지식산업센터 사무실). 임대인(대장 소유자) 김상용 (760802-2******) / 주소: 인천광역시 강화군 강화읍 동문로152번길 50, 101동402호(용정빌리지) — 1103호 소유자 신재선과 동일 주소 / 소유권이전 2024.3.12. 연락처 미확보(기기 연락처 미연결로 '2-1107' 조회 불가). 보증금 700만원 / 월세 70만원(조정 가능), 만기 2027년 4월 중순. 텐컴즈 매물번호 16410495242 (네이버등록안됨 보관, 미전송).\n[대장 실측] 전유 33.72㎡ / 공용 45.32㎡(주차장 22.01+공용 19.2+기타공용 4.11) / 계약 79.04㎡(23.9평). ※기준층 기타공용 4.11㎡를 제외하면 계약 74.93㎡(동일 전용 101동 606호 등록값). 지상 11층, 사용승인 2024.2.2, 건물ID 2220241574164859.\n[시설] 싱크대 상하부장 완비, 양문형 강화도어, 데코타일·조명 최상. 월관리비 12만원은 606호 기준 참고값(확인 필요).",
        "ownerAddress": "인천광역시 강화군 강화읍 동문로152번길 50, 101동402호 (용정빌리지)",
        "ownerIdNo": "760802-2******",
    },
    "status": "진행중",
    "createdById": "user_admin",
    "createdByName": "유수정 (대표자)",
    "createdAt": "2026-11-12",
    "photos": [
        "images/real_ait_1107_1.jpg",
        "images/real_ait_1107_2.jpg",
        "images/real_ait_1107_3.jpg",
        "images/real_ait_1107_4.jpg",
        "images/real_ait_1107_5.jpg",
        "images/real_ait_1107_6.jpg",
    ],
    "schedules": sched("2027-04-15", "AIT 101동 1107호 임대차 만기(2027년 4월 중순)", "2027-03-15", "만기 1개월 전 — 재계약/신규 임차인 입주일 협의 확인"),
    "owner": "김상용",
}

# 1) properties.json
pz = os.path.join(BASE, "data", "properties.json")
data = json.load(open(pz, encoding="utf-8"))
ids = {p["id"] for p in data}
added = []
for item in (p25, p24):
    if item["id"] in ids:
        data = [item if p["id"] == item["id"] else p for p in data]
    else:
        data.insert(0, item)
        added.append(item["id"])
json.dump(data, open(pz, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("properties.json:", len(data), "건, 신규:", added)

# 2) properties_data.js  (const INITIAL_PROPERTY_DATA = [...];)
pdj = os.path.join(BASE, "properties_data.js")
src = open(pdj, encoding="utf-8").read()
m = re.match(r"(?s)^(.*?const INITIAL_PROPERTY_DATA\s*=\s*)(\[.*\])(;\s*)$", src)
if not m:
    raise SystemExit("properties_data.js 형식을 찾지 못했습니다")
body = json.dumps(data, ensure_ascii=False, indent=2)
open(pdj, "w", encoding="utf-8").write(m.group(1) + body + m.group(3))
print("properties_data.js 갱신 완료")

# 3) 캐시 키 V35 -> V36
changed = []
for fn in ("app.js", "index.html", "housing.html", "commercial.html", "ledger.html", "services.html"):
    fp = os.path.join(BASE, fn)
    if not os.path.exists(fp):
        continue
    t = open(fp, encoding="utf-8").read()
    n = t.count("SMART_BROKER_PROPERTIES_V35")
    if n:
        open(fp, "w", encoding="utf-8").write(t.replace("SMART_BROKER_PROPERTIES_V35", "SMART_BROKER_PROPERTIES_V36"))
        changed.append((fn, n))
print("캐시키 격상:", changed)
