"""배포 전 공개 파일 민감정보 검사.

홈페이지(GitHub Pages)로 나가는 파일에 연락처, 주민번호, 도어락/현관 비번,
비공개 연락처 항목이 들어 있으면 실패(exit 1)해서 배포를 멈춘다.
사용: python3 .github/scripts/check_public_data.py <검사할 폴더>
"""
import json
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'

# 사무소 대표번호 등 공개해도 되는 번호
ALLOWED_PHONES = {
    '01022851585', '01091252285',
    '01012345678', '01098765432', '01000000000',  # 입력 예시(placeholder)
}

PHONE = re.compile(r'01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}')
RRN = re.compile(r'\b\d{6}-[1-4](?:\d{6}|\*)')
DOOR = re.compile(r'(현종\s*\d|현#\s*\d|현\s+#?\d{3,}|현경키\s*\d|현경열\s*\d|현열\s*\d|\d+층\s*비번\s*\d|도어락\s*비밀번호\s*[:：]\s*\d|비번\s*[:：]?\s*\d{4})')
CONTACT_FIELDS = ('clientName', 'clientPhone', 'ownerName', 'ownerPhone', 'privateMemo', 'ownerAddress', 'ownerIdNo')

DATA_FILES = {'properties_data.js', 'properties.json', 'clients.json'}
SKIP_DIRS = {'.git', 'vendor', 'images', 'secure', 'node_modules'}
TEXT_EXT = ('.js', '.json', '.html', '.htm', '.md', '.txt', '.csv')

problems = []


def digits(s):
    return re.sub(r'\D', '', s)


def check_text(path, text, is_data):
    for m in PHONE.finditer(text):
        if digits(m.group()) not in ALLOWED_PHONES:
            problems.append(f'{path}: 전화번호 형식 발견')
            break
    if RRN.search(text):
        problems.append(f'{path}: 주민번호 형식 발견')
    if DOOR.search(text):
        problems.append(f'{path}: 도어락/현관 비번으로 보이는 문구 발견')


def check_contacts(path, text):
    try:
        s, e = text.index('['), text.rindex(']')
        arr = json.loads(text[s:e + 1])
    except Exception:
        return
    if not isinstance(arr, list):
        return
    if os.path.basename(path) == 'clients.json' and arr:
        problems.append(f'{path}: 고객장 데이터는 공개 파일에 둘 수 없음 (빈 배열이어야 함)')
        return
    bad = 0
    for p in arr:
        if not isinstance(p, dict):
            continue
        c = p.get('contacts') or {}
        if any(isinstance(c.get(k), str) and c.get(k).strip() for k in CONTACT_FIELDS) or p.get('owner'):
            bad += 1
    if bad:
        problems.append(f'{path}: 연락처(contacts) 또는 소유자 정보가 채워진 매물 {bad}건')


for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fn in filenames:
        if not fn.endswith(TEXT_EXT):
            continue
        if fn.endswith('.json') and '매물백업' in fn:
            problems.append(f'{os.path.join(dirpath, fn)}: 암호화되지 않은 매물 백업 파일')
            continue
        path = os.path.join(dirpath, fn)
        try:
            text = open(path, encoding='utf-8').read()
        except Exception:
            continue
        is_data = fn in DATA_FILES
        check_text(path, text, is_data)
        if is_data:
            check_contacts(path, text)

# 암호화 파일은 형식만 확인
sec = os.path.join(ROOT, 'shareal', 'secure')
if os.path.isdir(sec):
    for fn in os.listdir(sec):
        if fn.endswith('.json'):
            try:
                d = json.load(open(os.path.join(sec, fn), encoding='utf-8'))
                if not (isinstance(d, dict) and d.get('format') == 'SHAREAL-SECURE-1' and 'ct' in d):
                    problems.append(f'shareal/secure/{fn}: 암호화 파일 형식이 아님')
            except Exception:
                problems.append(f'shareal/secure/{fn}: 읽을 수 없는 파일')

if problems:
    print('공개 파일에서 민감정보가 발견되어 배포를 중단합니다:')
    for p in sorted(set(problems)):
        print(' -', p)
    print('연락처·비번은 매물장 화면과 암호화 보안자료에만 두세요. (AGENTS.md 참고)')
    sys.exit(1)
print('민감정보 검사 통과')
