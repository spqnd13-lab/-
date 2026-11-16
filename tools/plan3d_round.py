"""3D 도면 모형 파일의 좌표 소수점을 줄인다 (기본 4자리).

원본 좌표는 도면 이미지의 픽셀이라 소수점 15자리는 의미가 없고,
긴 소수가 민감정보 검사의 전화번호 패턴에 잘못 걸린다.
사용: python3 tools/plan3d_round.py [자릿수]
"""
import glob
import json
import os
import sys

DIGITS = int(sys.argv[1]) if len(sys.argv) > 1 else 4
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'shareal', '3d', 'model-scripts')


def trim(v):
    if isinstance(v, float):
        r = round(v, DIGITS)
        return int(r) if r == int(r) else r
    if isinstance(v, list):
        return [trim(x) for x in v]
    if isinstance(v, dict):
        return {k: trim(x) for k, x in v.items()}
    return v


before = after = 0
for path in sorted(glob.glob(os.path.join(SRC, 'P*.js'))):
    text = open(path, encoding='utf-8').read()
    before += len(text.encode())
    head, body = text.split('=', 1)
    data = trim(json.loads(body.rstrip().rstrip(';')))
    out = head + '=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(path, 'w', encoding='utf-8').write(out)
    after += len(out.encode())
print('소수점 %d자리로 정리: %.1fMB → %.1fMB' % (DIGITS, before / 1e6, after / 1e6))
