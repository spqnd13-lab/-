import json, glob, os, re, sys
SRC = '/home/user/-/shareal/3d/model-scripts'

def levels_of(label):
    """'4~18층' → 4..18, '7~14층 · 16~17층' → 7..14,16,17, '1·2층' → 1,2"""
    out = set()
    for a, b in re.findall(r'(\d+)\s*[~\u223c\u2013\u2014-]\s*(\d+)\s*층', label):
        out.update(range(int(a), int(b) + 1))
    rest = re.sub(r'(\d+)\s*[~\u223c\u2013\u2014-]\s*(\d+)\s*층', ' ', label)
    for grp in re.findall(r'((?:\d+\s*·\s*)*\d+)\s*층', rest):
        out.update(int(n) for n in re.findall(r'\d+', grp))
    return sorted(out)


rows = []
for path in sorted(glob.glob(os.path.join(SRC, 'P*.js'))):
    s = open(path, encoding='utf-8').read()
    d = json.loads(s[s.index('=') + 1:].rstrip().rstrip(';'))
    lv = levels_of(d.get('planLabel', '') or '')
    rows.append({
        'id': d['id'],
        'building': d['building'],
        'planLabel': d.get('planLabel', ''),
        'usageLabel': d.get('usageLabel', ''),
        'levels': lv,
        'units': [u.get('label') or u.get('id') for u in (d.get('units') or []) if (u.get('label') or u.get('id'))],
    })
out = ['/* 자동 생성 파일 — tools/plan3d_catalog.py 로 다시 만듭니다. 직접 고치지 마세요. */',
       'window.PLAN_CATALOG = ' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';']
open('/home/user/-/shareal/3d/viewer-data.js', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(len(rows), 'plans;', len({r['building'] for r in rows}), 'buildings')
print('bytes:', os.path.getsize('/home/user/-/shareal/3d/viewer-data.js'))
