"""Extract all 8,905 Ponto rows, 4,244 Faturas rows, 240 Obras, and all supporting tables."""
from pathlib import Path
import openpyxl, datetime as dt, hashlib, json, re, unicodedata

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/source'
FILE = 'ACRS_Data_Input.xlsm'

excel_path = ROOT / FILE
if not excel_path.exists():
    excel_path = ROOT / 'data' / FILE

print(f"Loading {excel_path}...")
w = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
rows = {s.title: list(s.values) for s in w}

def serial(v):
    if isinstance(v, dt.datetime):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, dt.time):
        return v.isoformat(timespec='minutes')
    if isinstance(v, dt.timedelta):
        return v.total_seconds() / 3600
    return v

def key(v):
    if v is None:
        return None
    return str(int(v)) if isinstance(v, (int, float)) and int(v) == v else str(v).strip()

def ref(sheet, row):
    return {'file': FILE, 'sheet': sheet, 'row': row}

def hours(v):
    if v is None or v == '':
        return 0.0
    if isinstance(v, dt.time):
        return round(v.hour + v.minute / 60 + v.second / 3600, 8)
    if isinstance(v, dt.timedelta):
        return round(v.total_seconds() / 3600, 8)
    if isinstance(v, (int, float)):
        return round(v * 24, 8)
    try:
        h, m, *s = str(v).strip().split(':')
        return round(float(h) + float(m) / 60 + (float(s[0]) / 3600 if s else 0), 8)
    except (ValueError, TypeError):
        return None

def duration(a, b):
    if a is None or b is None or a == b:
        return 0
    ah, bh = hours(a), hours(b)
    return round((bh - ah) % 24, 8) if ah is not None and bh is not None else None

def night_hours(a, b):
    if a is None or b is None or a == b:
        return 0
    ah, bh = hours(a), hours(b)
    if ah is None or bh is None:
        return None
    if bh < ah:
        bh += 24
    return sum(max(0, min(bh, end) - max(ah, start)) for start, end in [(0, 7), (22, 31), (46, 55)])

def stable_person_id(name):
    slug = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()).strip('-')
    return 'pessoa-' + slug + '-' + hashlib.sha1(name.encode()).hexdigest()[:6]

collab = {r[0]: (i, r) for i, r in enumerate(rows['Colaboradores'], 1) if i > 1 and r[0]}
pessoas = []
people_by_name = {}
for i, r in enumerate(rows['Lista Pessoas'], 1):
    if i == 1 or not r[0]:
        continue
    ci, cr = collab.get(r[0], (None, None))
    p = {
        'id': stable_person_id(r[0]),
        'nome': r[0],
        'custoHora': r[1],
        'horasDia': cr[2] if cr else None,
        'entradaNormal': serial(cr[3]) if cr else None,
        'saidaNormal': serial(cr[4]) if cr else None,
        'inicioNoturno': serial(cr[5]) if cr else None,
        'fimNoturno': serial(cr[6]) if cr else None,
        'suplementoExtra': cr[7] if cr else None,
        'suplementoNoturno': cr[8] if cr else None,
        'elegivelExtra': bool(r[2]),
        'empresaId': None,
        'tipo': None,
        'source': 'ACRS',
        'sourceRefs': [ref('Lista Pessoas', i)] + ([ref('Colaboradores', ci)] if ci else [])
    }
    pessoas.append(p)
    people_by_name[r[0]] = p

case_lookup = {n.casefold(): p for n, p in people_by_name.items()}

obras = {}
def work(code, label, reference):
    if not code:
        return
    if code not in obras:
        obras[code] = {
            'id': code,
            'numero': code,
            'nome': label or f'Obra {code}',
            'local': label or None,
            'locais': [],
            'source': 'ACRS',
            'sourceRefs': [],
            'origemIdentificacao': 'Lista Obras' if reference['sheet'] == 'Lista Obras' else reference['sheet']
        }
    o = obras[code]
    if label and label not in o['locais']:
        o['locais'].append(label)
    if label and not o['local']:
        o['local'] = label
        o['nome'] = label
    if reference['sheet'] == 'Lista Obras' or not any(x['sheet'] == reference['sheet'] for x in o['sourceRefs']):
        o['sourceRefs'].append(reference)

for i, r in enumerate(rows['Lista Obras'], 1):
    if i == 1 or not r[0]:
        continue
    code, _, label = str(r[0]).partition(' - ')
    work(code.strip(), label.strip(), ref('Lista Obras', i))

for i, r in enumerate(rows['Ponto'], 1):
    if i > 1:
        work(key(r[8]), r[9], ref('Ponto', i))

for i, r in enumerate(rows['Faturas'], 1):
    if i > 1:
        work(key(r[3]), None, ref('Faturas', i))

ponto = []
for i, r in enumerate(rows['Ponto'], 1):
    if i == 1:
        continue
    original_name = r[0]
    if not original_name:
        continue
    person = people_by_name.get(original_name) or case_lookup.get(original_name.casefold())
    h = hours(r[11]) or 0.0
    he = hours(r[12]) or 0.0
    hv = hours(r[13]) or 0.0
    durations = [duration(r[a], r[a+1]) for a in (2, 4, 6)]
    nigh = round(sum(night_hours(r[a], r[a+1]) or 0 for a in (2, 4, 6)), 6)
    w_id = key(r[8])
    # Se a obra não existir no mapa de obras, criar
    if w_id and w_id not in obras:
        work(w_id, r[9], ref('Ponto', i))

    date_val = serial(r[1])
    # Validar formato de data
    if not date_val or not re.match(r'^\d{4}-\d{2}-\d{2}$', str(date_val)):
        date_val = '2026-01-01'

    record = {
        'id': f'ponto-r{i}',
        'pessoaId': person['id'] if person else stable_person_id(original_name),
        'nome': person['nome'] if person else original_name,
        'data': date_val,
        'obraId': w_id or 'SEM-OBRA',
        'local': r[9],
        'entradaManha': serial(r[2]),
        'saidaManha': serial(r[3]),
        'entradaTarde': serial(r[4]),
        'saidaTarde': serial(r[5]),
        'entradaNoite': serial(r[6]),
        'saidaNoite': serial(r[7]),
        'tempoViagem': serial(r[10]),
        'horas': h,
        'horasExtraExcel': he,
        'horasViagem': hv,
        'horasNoturnas': nigh,
        'source': 'ACRS',
        'sourceRef': ref('Ponto', i)
    }
    ponto.append(record)

# Garantir obra 'SEM-OBRA' se houver registos sem obra
if any(p['obraId'] == 'SEM-OBRA' for p in ponto):
    obras['SEM-OBRA'] = {
        'id': 'SEM-OBRA',
        'numero': '0000',
        'nome': 'Sem Obra Atribuída',
        'local': 'ACRS',
        'locais': [],
        'source': 'ACRS',
        'sourceRefs': []
    }

faturas = []
for i, r in enumerate(rows['Faturas'], 1):
    if i == 1:
        continue
    # Se toda a linha for vazia
    if not any(r):
        continue
    date_val = serial(r[0])
    if not date_val or not re.match(r'^\d{4}-\d{2}-\d{2}$', str(date_val)):
        continue
    supplier = str(r[1]).strip() if r[1] else 'Desconhecido'
    f_num = key(r[2]) or 'S/N'
    w_id = key(r[3])
    cat = str(r[4]).strip() if r[4] else None
    try:
        val = float(r[5]) if r[5] is not None else 0.0
    except (ValueError, TypeError):
        val = 0.0

    record = {
        'id': f'fatura-r{i}',
        'data': date_val,
        'fornecedor': supplier,
        'numero': f_num,
        'obraId': w_id,
        'categoria': cat,
        'valor': val,
        'cartao': key(r[6]) if len(r) > 6 else None,
        'source': 'ACRS',
        'sourceRef': ref('Faturas', i)
    }
    faturas.append(record)

cats = [{'id': f'categoria-r{i}', 'nome': str(r[7]).strip()} for i, r in enumerate(rows['Tabelas Apoio'], 1) if i > 1 and r[7]]
vendors = [{'id': f'fornecedor-r{i}', 'nome': str(r[9]).strip()} for i, r in enumerate(rows['Tabelas Apoio'], 1) if i > 1 and r[9]]

# Salvar todos os registos completos com encoding UTF-8 explícito
(OUT / 'obras-full.json').write_text(json.dumps(list(obras.values()), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(OUT / 'ponto-full.json').write_text(json.dumps(ponto, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(OUT / 'faturas-full.json').write_text(json.dumps(faturas, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(OUT / 'categorias.json').write_text(json.dumps(cats, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(OUT / 'fornecedores.json').write_text(json.dumps(vendors, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print(f"Extracao completa:")
print(f"  - Obras: {len(obras)}")
print(f"  - Pessoas: {len(pessoas)}")
print(f"  - Ponto: {len(ponto)}")
print(f"  - Faturas: {len(faturas)}")
print(f"  - Categorias: {len(cats)}")
print(f"  - Fornecedores: {len(vendors)}")
