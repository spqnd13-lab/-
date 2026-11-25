#!/usr/bin/env python3
"""가상 오피스(아티팩트) 내용을 저장소 파일로 내보낸다 — GPT(현아·피클)가 읽을 수 있게.

클로드가 ArtifactData 로 내려받은 JSON 폴더를 읽어 두 파일을 만든다.

  docs/ops/office-log.md     사람과 GPT가 읽는 요약
  docs/ops/office-log.json   기계용 원본

사용:
  python3 tools/office_sync.py <내려받은_폴더>
  python3 tools/office_sync.py <내려받은_폴더> --dry   파일을 쓰지 않고 결과만 보기

폴더 구조는 ArtifactData 의 out_dir 그대로:
  <폴더>/reports/*.json, <폴더>/agenda/*.json

공개 저장소에 나가는 파일이므로, 보고 본문에 전화번호·주민번호·비번으로 보이는 값이
있으면 그 본문은 올리지 않고 "[민감정보 포함 — 저장소에는 올리지 않음]" 으로 대체한다.
"""
import argparse
import datetime
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_MD = os.path.join(ROOT, 'docs', 'ops', 'office-log.md')
OUT_JSON = os.path.join(ROOT, 'docs', 'ops', 'office-log.json')

PHONE = re.compile(r'01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}')
RRN = re.compile(r'\b\d{6}-[1-4]')
SECRET = re.compile(r'(비밀번호|비번|도어락|현관\s*번호|현종|현#)')
MASKED = '[민감정보 포함 — 저장소에는 올리지 않음]'


def risky(text):
    t = str(text or '')
    return bool(PHONE.search(t) or RRN.search(t) or SECRET.search(t))


def load(folder, name):
    rows = []
    for f in sorted(glob.glob(os.path.join(folder, name, '*.json'))):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception as e:
            print(f'건너뜀 {f}: {e}', file=sys.stderr)
            continue
        body = d.get('data', d)
        body['id'] = d.get('id') or os.path.splitext(os.path.basename(f))[0]
        rows.append(body)
    return rows


def clean_reports(rows):
    masked = 0
    out = []
    for r in sorted(rows, key=lambda x: str(x.get('at', '')), reverse=True):
        text = r.get('text', '')
        if risky(text):
            text = MASKED
            masked += 1
        out.append({
            'id': r.get('id'), 'team': r.get('team', ''), 'job': r.get('dept', ''),
            'at': r.get('at', ''), 'status': r.get('status', '대기'), 'text': text,
        })
    return out, masked


def clean_agenda(rows):
    out = []
    for a in sorted(rows, key=lambda x: x.get('order', 0)):
        reviews = []
        for rv in a.get('reviews', []) or []:
            t = rv.get('text', '')
            reviews.append({'by': rv.get('by', ''), 'text': MASKED if risky(t) else t})
        out.append({
            'id': a.get('id'), 'order': a.get('order', 0), 'title': a.get('title', ''),
            'by': a.get('by', ''), 'status': a.get('status', '검토중'), 'goal': a.get('goal', ''),
            'plan': a.get('plan', []), 'edit': a.get('edit', []), 'reviews': reviews,
            'decidedAt': a.get('decidedAt', ''),
        })
    return out


def to_markdown(reports, agenda, masked, when):
    waiting = [r for r in reports if r['status'] != '확인']
    pending = [a for a in agenda if a['status'] == '검토중']
    confirmed = [a for a in agenda if a['status'] == '컨펌']
    L = []
    L.append('# 가상 오피스 기록 (자동 생성)')
    L.append('')
    L.append(f'내보낸 시각: {when} · 이 파일은 `tools/office_sync.py` 가 만듭니다. 손으로 고치지 마세요.')
    L.append('')
    L.append(f'- 업무 보고 {len(reports)}건 (전달 대기 {len(waiting)}건)')
    L.append(f'- 채널 안건 {len(agenda)}건 (컨펌 대기 {len(pending)}건 · 컨펌됨 {len(confirmed)}건)')
    if masked:
        L.append(f'- 민감정보가 있어 본문을 가린 보고 {masked}건 (원문은 오피스 화면에서만 볼 수 있습니다)')
    L.append('')
    L.append('## 1. 업무 보고')
    L.append('')
    if not reports:
        L.append('아직 올라온 보고가 없습니다.')
    for r in reports[:50]:
        head = ' · '.join(x for x in [r['at'][:16].replace('T', ' '), r['team'], r['job'], r['status']] if x)
        L.append(f'- **{head}**')
        L.append(f'  - {r["text"]}')
    L.append('')
    L.append('## 2. 채널 안건')
    L.append('')
    for a in agenda:
        L.append(f'### {a["order"]}. {a["title"]} — {a["status"]}')
        L.append('')
        L.append(f'- 제안: {a["by"]}')
        if a['goal']:
            L.append(f'- 목표(콜 유도): {a["goal"]}')
        if a['plan']:
            L.append('- 콘텐츠 구성:')
            for x in a['plan']:
                L.append(f'  - {x}')
        if a['edit']:
            L.append('- 편집 디테일:')
            for x in a['edit']:
                L.append(f'  - {x}')
        for rv in a['reviews']:
            L.append(f'- 검수({rv["by"]}): {rv["text"]}')
        L.append('')
    L.append('---')
    L.append('')
    L.append('현아(GPT)가 할 말·기획은 `docs/plan/` 에 양식대로 올려 주세요. 클로드가 읽어 오피스 회의실에 반영합니다.')
    L.append('연결 방법은 `docs/ops/gpt-bridge.md` 에 있습니다.')
    return '\n'.join(L) + '\n'


def main():
    ap = argparse.ArgumentParser(description='가상 오피스 내용을 저장소 파일로 내보내기')
    ap.add_argument('folder', help='ArtifactData 로 내려받은 폴더 (reports/, agenda/ 가 들어 있음)')
    ap.add_argument('--dry', action='store_true', help='파일을 쓰지 않고 결과만 출력')
    a = ap.parse_args()

    reports, masked = clean_reports(load(a.folder, 'reports'))
    agenda = clean_agenda(load(a.folder, 'agenda'))
    when = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    md = to_markdown(reports, agenda, masked, when)
    data = {'exportedAt': when, 'reports': reports, 'agenda': agenda, 'maskedReports': masked}

    if a.dry:
        print(md)
        return
    os.makedirs(os.path.dirname(OUT_MD), exist_ok=True)
    open(OUT_MD, 'w', encoding='utf-8').write(md)
    json.dump(data, open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'보고 {len(reports)}건, 안건 {len(agenda)}건 내보냄' + (f' (가린 보고 {masked}건)' if masked else ''))
    print(f'  {os.path.relpath(OUT_MD, ROOT)}')
    print(f'  {os.path.relpath(OUT_JSON, ROOT)}')


if __name__ == '__main__':
    main()
