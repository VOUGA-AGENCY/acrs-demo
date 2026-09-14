"""Read-only extraction of the supplied workbook. No Excel formulas or macros run."""
from pathlib import Path
import openpyxl, datetime as dt, collections, hashlib, json, re, unicodedata, xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/source'
OUT.mkdir(exist_ok=True)
FILE='ACRS_Data_Input.xlsm'
w=openpyxl.load_workbook(ROOT/'data'/FILE,read_only=True,data_only=True)
rows={s.title:list(s.values) for s in w}
SELECTED=['26095','26108','26105','26011','26111','26066','26090','26100','26107','26109','25061','25094']

def serial(v):
    if isinstance(v,dt.datetime): return v.strftime('%Y-%m-%d')
    if isinstance(v,dt.time): return v.isoformat(timespec='minutes')
    if isinstance(v,dt.timedelta): return v.total_seconds()/3600
    return v
def key(v):
    if v is None: return None
    return str(int(v)) if isinstance(v,(int,float)) and int(v)==v else str(v).strip()
def ref(sheet,row): return {'file':FILE,'sheet':sheet,'row':row}
def save(name,data): (OUT/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2,default=serial)+'\n')
def hours(v):
    if v is None or v=='': return 0.0
    if isinstance(v,dt.time): return round(v.hour+v.minute/60+v.second/3600,8)
    if isinstance(v,dt.timedelta): return round(v.total_seconds()/3600,8)
    if isinstance(v,(int,float)): return round(v*24,8)
    try:
        h,m,*s=str(v).strip().split(':')
        return round(float(h)+float(m)/60+(float(s[0])/3600 if s else 0),8)
    except (ValueError,TypeError): return None
def duration(a,b):
    if a is None or b is None or a==b:return 0
    ah,bh=hours(a),hours(b)
    return round((bh-ah)%24,8) if ah is not None and bh is not None else None
def night_hours(a,b):
    if a is None or b is None or a==b:return 0
    ah,bh=hours(a),hours(b)
    if ah is None or bh is None:return None
    if bh<ah: bh+=24
    return sum(max(0,min(bh,end)-max(ah,start)) for start,end in [(0,7),(22,31),(46,55)])
def stable_person_id(name):
    slug=re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower()).strip('-')
    return 'pessoa-'+slug+'-'+hashlib.sha1(name.encode()).hexdigest()[:6]

collab={r[0]:(i,r) for i,r in enumerate(rows['Colaboradores'],1) if i>1 and r[0]}
pessoas=[]
people_by_name={}
for i,r in enumerate(rows['Lista Pessoas'],1):
    if i==1 or not r[0]:continue
    ci,cr=collab.get(r[0],(None,None))
    p={'id':stable_person_id(r[0]),'nome':r[0],'custoHora':r[1],'horasDia':cr[2] if cr else None,
       'entradaNormal':serial(cr[3]) if cr else None,'saidaNormal':serial(cr[4]) if cr else None,
       'inicioNoturno':serial(cr[5]) if cr else None,'fimNoturno':serial(cr[6]) if cr else None,
       'suplementoExtra':cr[7] if cr else None,'suplementoNoturno':cr[8] if cr else None,
       'elegivelExtra':bool(r[2]),'empresaId':None,'tipo':None,'source':'ACRS',
       'sourceRefs':[ref('Lista Pessoas',i)]+([ref('Colaboradores',ci)] if ci else [])}
    pessoas.append(p);people_by_name[r[0]]=p
case_lookup={n.casefold():p for n,p in people_by_name.items()}

obras={}
def work(code,label,reference):
    if not code:return
    if code not in obras:
        obras[code]={'id':code,'numero':code,'nome':label or f'Obra {code}','local':label or None,'locais':[],'source':'ACRS','sourceRefs':[],'selecionadaDemo':code in SELECTED,'origemIdentificacao':'Lista Obras' if reference['sheet']=='Lista Obras' else reference['sheet']}
    o=obras[code]
    if label and label not in o['locais']:o['locais'].append(label)
    if label and not o['local']:o['local']=label;o['nome']=label
    if reference['sheet']=='Lista Obras' or not any(x['sheet']==reference['sheet'] for x in o['sourceRefs']):o['sourceRefs'].append(reference)
for i,r in enumerate(rows['Lista Obras'],1):
    if i==1 or not r[0]:continue
    code,_,label=str(r[0]).partition(' - ')
    work(code,label,ref('Lista Obras',i))
for i,r in enumerate(rows['Ponto'],1):
    if i>1:work(key(r[8]),r[9],ref('Ponto',i))
for i,r in enumerate(rows['Faturas'],1):
    if i>1:work(key(r[3]),None,ref('Faturas',i))

ponto=[];point_audit=[]
for i,r in enumerate(rows['Ponto'],1):
    if i==1:continue
    original_name=r[0]
    person=people_by_name.get(original_name) or case_lookup.get(original_name.casefold())
    h=hours(r[11]);he=hours(r[12]);hv=hours(r[13])
    durations=[duration(r[a],r[a+1]) for a in (2,4,6)]
    calculated=round(sum(durations),6) if all(x is not None for x in durations) else None
    nigh=round(sum(night_hours(r[a],r[a+1]) or 0 for a in (2,4,6)),6)
    record={'id':f'ponto-r{i}','pessoaId':person['id'] if person else None,'nome':person['nome'] if person else original_name,'nomeOriginal':original_name,
            'data':serial(r[1]),'obraId':key(r[8]),'local':r[9],
            'entradaManha':serial(r[2]),'saidaManha':serial(r[3]),'entradaTarde':serial(r[4]),'saidaTarde':serial(r[5]),
            'entradaNoite':serial(r[6]),'saidaNoite':serial(r[7]),'tempoViagem':serial(r[10]),
            'horas':h,'horasExtraExcel':he,'horasViagem':hv,'horasNoturnas':nigh,
            'source':'ACRS','sourceRef':ref('Ponto',i),'horasNoturnasMetodo':'Sobreposição dos intervalos registados com 22:00–07:00; duração derivada, sem regra salarial.'}
    issues=[]
    if person and person['nome']!=original_name:issues.append('Nome associado por correspondência sem distinção de maiúsculas; original preservado.')
    if not isinstance(r[1],dt.datetime) or r[1].year<2020:issues.append('Data original inválida para o período operacional.')
    if calculated is not None and h is not None and abs(calculated-h)>0.0001:issues.append(f'Horas calculadas dos intervalos ({calculated}) diferem do valor Excel ({h}).')
    if issues:record['notasOrigem']=issues;point_audit.append({'row':i,'issues':issues})
    if key(r[8]) in SELECTED:ponto.append(record)

faturas=[]
for i,r in enumerate(rows['Faturas'],1):
    if i==1 or key(r[3]) not in SELECTED:continue
    record={'id':f'fatura-r{i}','data':serial(r[0]),'fornecedor':r[1],'numero':key(r[2]),'obraId':key(r[3]),'categoria':r[4],'valor':r[5],
            'source':'ACRS','sourceRef':ref('Faturas',i)}
    # Internal payment-card identifiers are unnecessary for the requested demo.
    if isinstance(r[2],(int,float)):record['numeroOriginalNumerico']=r[2]
    faturas.append(record)

def date_range(data):
    dates=[r['data'] for r in data if isinstance(r['data'],str) and re.match(r'20\d\d-',r['data'])]
    return {'inicio':min(dates),'fim':max(dates)} if dates else None

selection=[]
for wid in SELECTED:
    pp=[p for p in ponto if p['obraId']==wid];ff=[f for f in faturas if f['obraId']==wid]
    selection.append({'obraId':wid,'nome':obras[wid]['nome'],'pontoRegistos':len(pp),'faturasRegistos':len(ff),
                      'pontoPeriodo':date_range(pp),'faturasPeriodo':date_range(ff),'horasExcel':round(sum(p['horas'] or 0 for p in pp),6),
                      'valorFaturas':round(sum(f['valor'] for f in ff),6),'pessoas':len({p['pessoaId'] for p in pp})})

cats=[{'id':'categoria-r'+str(i),'nome':r[7],'source':'ACRS','sourceRef':ref('Tabelas Apoio',i)} for i,r in enumerate(rows['Tabelas Apoio'],1) if i>1 and r[7]]
vendors=[{'id':'fornecedor-r'+str(i),'nome':r[9],'source':'ACRS','sourceRef':ref('Tabelas Apoio',i)} for i,r in enumerate(rows['Tabelas Apoio'],1) if i>1 and r[9]]
count_summary={'source':'ACRS','file':FILE,'metodo':'Todas as dimensões. Todos os registos históricos das 12 obras selecionadas; sem corte por data. Nenhuma data foi atualizada para a data da demo.',
               'totalLinhasPonto':len(rows['Ponto'])-1,'totalLinhasFaturas':len(rows['Faturas'])-1,'totalPessoasLista':len(pessoas),
               'totalObrasReferenciadas':len(obras),'pontoExtraido':len(ponto),'faturasExtraidas':len(faturas),'pontoPeriodo':date_range(ponto),'faturasPeriodo':date_range(faturas),
               'obraIdsSelecionadas':SELECTED,'obrasSelecionadas':selection,'anomaliasPonto':point_audit,
               'limites':['Valores de fórmulas são os resultados em cache guardados no Excel; não foi executado Excel/Power BI nem macros.',
                          'A folha não contém estado de validação das faturas, empresa da pessoa, cliente formal, orçamento, margem ou responsável da obra.',
                          'Uma data de ponto em 1900 e uma fatura sem data existem na fonte global, fora do subconjunto selecionado.',
                          'Categorias e fornecedores mantêm grafia original. Não foi feita reconciliação de sinónimos nem deduplicação de faturas.',
                          'Não são extraídos identificadores internos de cartões, por não serem necessários aos fluxos pedidos.',
                          'Lista Obras contém rótulos Obra - Local, não uma ficha de cliente. Nomes de local não são promovidos a cliente real.',
                          'Obras apenas referenciadas por Faturas são incluídas sem local; códigos compostos e suspeitos não foram corrigidos.'],
                'xmlTeste':{'file':'teste-fornecedor.xml','root':'catalogo','registos':len(ET.parse(ROOT/'data/teste-fornecedor.xml').getroot()),'campos':['sku','nome','preco','stock','categoria (opcional)','imagem_url (opcional)'],'classificacao':'Catálogo de teste com eletrónica/casa. Não é fatura, inventário ou fornecedor comprovado ACRS. Não importado para a demo.'}}
save('pessoas',pessoas)
save('obras',list(obras.values()))
save('ponto',ponto)
save('faturas',faturas)
save('empresas',[])
save('categorias',cats)
save('fornecedores',vendors)
save('excel-summary',count_summary)
assert len({p['id'] for p in pessoas})==len(pessoas)
assert all(p['pessoaId'] in {person['id'] for person in pessoas} for p in ponto)
assert all(f['obraId'] in obras for f in faturas)
assert all(p['obraId'] in obras for p in ponto)
assert len(ponto)==sum(1 for r in rows['Ponto'][1:] if key(r[8]) in SELECTED)
assert len(faturas)==sum(1 for r in rows['Faturas'][1:] if key(r[3]) in SELECTED)
print(json.dumps({k:count_summary[k] for k in ['totalLinhasPonto','totalLinhasFaturas','totalPessoasLista','totalObrasReferenciadas','pontoExtraido','faturasExtraidas','pontoPeriodo','faturasPeriodo','obrasSelecionadas']},ensure_ascii=False,indent=2))
print('Point anomalies',json.dumps(point_audit,ensure_ascii=False))
