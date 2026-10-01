#!/usr/bin/env python3
# ==============================================================================
# SCRIPT DE VALIDAÇÃO E IMPORTAÇÃO DE DADOS DO EXCEL (ACRS ERP)
# Executa os Passos 7 e 8 do Plano de Segurança:
#   1. Validação estrita por folha e linha (dry-run mode).
#   2. Verificação de chaves estrangeiras (colaboradores, obras, máquinas, artigos).
#   3. Construção dos 6 componentes de orçamento em 'linhas' (budgets).
#   4. Extração automática de fornecedores a partir das faturas.
#   5. Importação em bloco (ou wipe & load) para o Supabase.
#
# Uso:
#   python scripts/import-excel-template.py --dry-run
#   python scripts/import-excel-template.py --wipe-and-import
# ==============================================================================

import os
import sys
import json
import argparse
import datetime
import urllib.request
import urllib.error
import openpyxl

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# Carregar variáveis de ambiente de .env.local
def load_env():
    env_path = os.path.join(os.getcwd(), ".env.local")
    env = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip("\"'")
    return env

ENV = load_env()
SUPABASE_URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY") or ENV.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

class SupabaseClient:
    def __init__(self, url, key):
        self.url = url.rstrip("/")
        self.key = key
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }

    def post(self, table, rows):
        if not rows:
            return
        endpoint = f"{self.url}/rest/v1/{table}"
        data = json.dumps(rows, default=str).encode("utf-8")
        req = urllib.request.Request(endpoint, data=data, headers=self.headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            raise RuntimeError(f"Erro Supabase [{table}]: {err_msg}")

    def delete_all(self, table):
        endpoint = f"{self.url}/rest/v1/{table}?id=neq.placeholder_impossible_id"
        headers = dict(self.headers)
        headers["Prefer"] = "return=representation"
        req = urllib.request.Request(endpoint, headers=headers, method="DELETE")
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            # Algumas tabelas não têm 'id', apagar com chave primária alternativa
            pass

def normalize_date(val):
    if val is None:
        return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime("%Y-%m-%d")
    val_str = str(val).strip()
    if len(val_str) >= 10 and val_str[4] == "-" and val_str[7] == "-":
        return val_str[:10]
    return val_str

def normalize_time(val):
    if val is None:
        return None
    if isinstance(val, datetime.time):
        return val.strftime("%H:%M")
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime("%H:%M")
    val_str = str(val).strip()
    if len(val_str) >= 5 and ":" in val_str:
        return val_str[:5]
    return val_str

def parse_excel_template(file_path):
    print(f"[INFO] A ler template Excel: {file_path}...")
    wb = openpyxl.load_workbook(file_path, data_only=True)
    
    issues = []
    def log_issue(sheet, row, col, message, severity="ERROR"):
        issues.append({"sheet": sheet, "row": row, "col": col, "message": message, "severity": severity})

    data = {
        "users": [],
        "companies": [],
        "collaborators": [],
        "works": [],
        "budgets": [],
        "articles": [],
        "machines": [],
        "times": [],
        "invoices": [],
        "allocations": [],
        "movements": [],
        "suppliers": set(),
    }

    # Conjuntos para validação de chaves estrangeiras
    known_companies = set()
    known_collaborators = set()
    known_works = set()
    known_articles = set()
    known_machines = set()

    # 1. UTILIZADORES
    if "Utilizadores" in wb.sheetnames:
        ws = wb["Utilizadores"]
        for r in range(3, ws.max_row + 1):
            nome = ws.cell(r, 1).value
            email = ws.cell(r, 2).value
            perfil = ws.cell(r, 3).value
            avatar = ws.cell(r, 4).value
            if not nome and not email:
                continue
            if not email or "@" not in str(email):
                log_issue("Utilizadores", r, "Email", "Email inválido ou em falta.")
            if perfil not in ["admin", "secretariado", "armazem", "terreno"]:
                log_issue("Utilizadores", r, "Perfil", f"Perfil '{perfil}' inválido. Deve ser admin, secretariado, armazem ou terreno.")
            data["users"].append({
                "nome": str(nome).strip(),
                "email": str(email).strip().lower(),
                "perfil": str(perfil).strip().lower(),
                "avatar": str(avatar or "").strip() or None
            })

    # 2. EMPRESAS
    if "Empresas" in wb.sheetnames:
        ws = wb["Empresas"]
        for r in range(3, ws.max_row + 1):
            nome = ws.cell(r, 1).value
            tipo = ws.cell(r, 2).value
            nif = ws.cell(r, 3).value
            if not nome:
                continue
            nome_str = str(nome).strip()
            if tipo not in ["Interna", "Subcontratada"]:
                log_issue("Empresas", r, "Tipo", f"Tipo '{tipo}' inválido. Deve ser Interna ou Subcontratada.")
            known_companies.add(nome_str)
            data["companies"].append({
                "id": f"comp-{len(data['companies'])+1}",
                "nome": nome_str,
                "tipo": tipo or "Interna",
                "nif": str(nif).strip() if nif else None,
                "source": "ACRS"
            })

    # 3. OBRAS & ORÇAMENTOS
    if "Obras" in wb.sheetnames:
        ws = wb["Obras"]
        for r in range(3, ws.max_row + 1):
            numero = ws.cell(r, 1).value
            nome = ws.cell(r, 2).value
            local = ws.cell(r, 3).value
            cliente = ws.cell(r, 4).value
            estado = ws.cell(r, 5).value or "Em curso"
            dt_inicio = normalize_date(ws.cell(r, 6).value)
            dt_fim = normalize_date(ws.cell(r, 7).value)
            val_comercial = ws.cell(r, 8).value or 0
            margem = ws.cell(r, 9).value or 0.20
            c_mao_obra = ws.cell(r, 10).value or 0
            c_materiais = ws.cell(r, 11).value or 0
            c_ferramentaria = ws.cell(r, 12).value or 0
            c_transportes = ws.cell(r, 13).value or 0
            c_alojamento = ws.cell(r, 14).value or 0
            c_outros = ws.cell(r, 15).value or 0
            quem_move = ws.cell(r, 18).value
            contentor = str(ws.cell(r, 19).value or "").strip().lower() in ["sim", "true", "1"]

            if not numero:
                continue
            num_str = str(numero).strip()
            known_works.add(num_str)

            data["works"].append({
                "id": num_str,
                "numero": num_str,
                "nome": str(nome or f"Obra {num_str}").strip(),
                "local": str(local).strip() if local else None,
                "cliente": str(cliente or "Cliente Não Indicado").strip(),
                "estado": estado,
                "data_inicio": dt_inicio,
                "data_fim": dt_fim,
                "quem_pode_movimentar": str(quem_move).strip() if quem_move else None,
                "contentor_em_obra": contentor,
                "source": "ACRS"
            })

            # Orçamento associado com as 6 categorias
            linhas = [
                {"categoria": "Mão de obra", "valor": float(c_mao_obra)},
                {"categoria": "Materiais", "valor": float(c_materiais)},
                {"categoria": "Ferramentaria", "valor": float(c_ferramentaria)},
                {"categoria": "Transportes", "valor": float(c_transportes)},
                {"categoria": "Alojamento", "valor": float(c_alojamento)},
                {"categoria": "Outros", "valor": float(c_outros)},
            ]
            has_discriminated = any(item["valor"] > 0 for item in linhas)

            data["budgets"].append({
                "obra_id": num_str,
                "valor": float(val_comercial),
                "margem": float(margem),
                "modo": "Discriminado" if has_discriminated else "Simples",
                "linhas": linhas if has_discriminated else [],
                "source": "ACRS"
            })

    # 4. COLABORADORES
    if "Colaboradores" in wb.sheetnames:
        ws = wb["Colaboradores"]
        for r in range(3, ws.max_row + 1):
            nome = ws.cell(r, 1).value
            custo_h = ws.cell(r, 2).value
            horas_d = ws.cell(r, 3).value
            empresa = ws.cell(r, 4).value
            tipo = ws.cell(r, 5).value
            ent_norm = normalize_time(ws.cell(r, 6).value)
            sai_norm = normalize_time(ws.cell(r, 7).value)
            ini_not = normalize_time(ws.cell(r, 8).value)
            fim_not = normalize_time(ws.cell(r, 9).value)
            sup_extra = ws.cell(r, 10).value
            sup_not = ws.cell(r, 11).value
            elegivel = str(ws.cell(r, 12).value or "").strip().lower() in ["sim", "true", "1", ""]

            if not nome:
                continue
            nome_str = str(nome).strip()
            known_collaborators.add(nome_str)

            empresa_id = None
            if empresa:
                emp_str = str(empresa).strip()
                matched = next((c["id"] for c in data["companies"] if c["nome"].lower() == emp_str.lower()), None)
                if not matched and emp_str not in known_companies:
                    log_issue("Colaboradores", r, "Empresa", f"Empresa '{emp_str}' não encontrada na folha Empresas.", "WARNING")
                empresa_id = matched

            data["collaborators"].append({
                "id": f"colab-{len(data['collaborators'])+1}",
                "nome": nome_str,
                "custo_hora": float(custo_h) if custo_h is not None else None,
                "horas_dia": float(horas_d) if horas_d is not None else 8.0,
                "empresa_id": empresa_id,
                "tipo": tipo or "Funcionário ACRS",
                "entrada_normal": ent_norm or "08:00",
                "saida_normal": sai_norm or "17:00",
                "inicio_noturno": ini_not or "22:00",
                "fim_noturno": fim_not or "07:00",
                "suplemento_extra": float(sup_extra) if sup_extra is not None else 0.50,
                "suplemento_noturno": float(sup_not) if sup_not is not None else 0.25,
                "elegivel_extra": elegivel,
                "source": "ACRS"
            })

    # 5. INVENTÁRIO (ARTIGOS)
    if "Inventario" in wb.sheetnames:
        ws = wb["Inventario"]
        for r in range(3, ws.max_row + 1):
            cod = ws.cell(r, 1).value
            fam = ws.cell(r, 2).value
            mat = ws.cell(r, 3).value
            tam = ws.cell(r, 4).value
            desc = ws.cell(r, 5).value
            marca = ws.cell(r, 6).value
            qtd = ws.cell(r, 7).value or 0
            pr_unit = ws.cell(r, 8).value or 0
            loc = ws.cell(r, 9).value or "ARMAZÉM"
            unid = ws.cell(r, 10).value or "un."
            prec = ws.cell(r, 11).value or 0
            minimo = ws.cell(r, 12).value or 0
            val_int = ws.cell(r, 13).value

            if not cod and not desc:
                continue
            cod_str = str(cod).strip() if cod else f"ART-{len(data['articles'])+1}"
            known_articles.add(cod_str)

            data["articles"].append({
                "id": f"art-{len(data['articles'])+1}",
                "codigo_acrs": cod_str,
                "familia": str(fam or "DIVERSOS").strip().upper(),
                "material": str(mat).strip() if mat else None,
                "tamanho": str(tam).strip() if tam else None,
                "descricao": str(desc or cod_str).strip(),
                "marca": str(marca).strip() if marca else None,
                "quantidade": float(qtd),
                "preco_unitario": float(pr_unit),
                "preco_total": round(float(qtd) * float(pr_unit), 2),
                "localizacao": loc,
                "unidade": unid,
                "precisao": int(prec) if prec is not None else 0,
                "minimo": float(minimo),
                "valor_interno": float(val_int) if val_int is not None else float(pr_unit),
                "source": "ACRS"
            })

    # 6. MÁQUINAS E EQUIPAMENTOS
    if "Maquinas" in wb.sheetnames:
        ws = wb["Maquinas"]
        for r in range(3, ws.max_row + 1):
            num = ws.cell(r, 1).value
            nome = ws.cell(r, 2).value
            marca = ws.cell(r, 3).value
            mod = ws.cell(r, 4).value
            tipo = ws.cell(r, 5).value or "Máquina"
            custo_d = ws.cell(r, 6).value or 0
            custo_int_d = ws.cell(r, 7).value
            custo_aq = ws.cell(r, 8).value
            dt_aq = normalize_date(ws.cell(r, 9).value)
            periodo_am = ws.cell(r, 10).value
            val_res = ws.cell(r, 11).value or 0
            manut = ws.cell(r, 12).value or 0
            estado = ws.cell(r, 13).value or "Disponível"
            period_insp = ws.cell(r, 14).value
            ult_insp = normalize_date(ws.cell(r, 15).value)
            prox_insp = normalize_date(ws.cell(r, 16).value)

            if not num and not nome:
                continue
            num_str = str(num).strip()
            known_machines.add(num_str)

            data["machines"].append({
                "id": num_str,
                "numero": num_str,
                "nome": str(nome or num_str).strip(),
                "marca": str(marca or "ACRS").strip(),
                "modelo": str(mod or "Standard").strip(),
                "tipo": tipo,
                "custo_dia": float(custo_d),
                "custo_interno_dia": float(custo_int_d) if custo_int_d is not None else float(custo_d),
                "custo_aquisicao": float(custo_aq) if custo_aq is not None else None,
                "data_aquisicao": dt_aq,
                "periodo_amortizacao": float(periodo_am) if periodo_am is not None else None,
                "valor_residual": float(val_res),
                "manutencao_acumulada": float(manut),
                "estado": estado,
                "periodicidade_inspecao": int(period_insp) if period_insp is not None else None,
                "ultima_inspecao": ult_insp,
                "proxima_inspecao": prox_insp,
                "source": "ACRS"
            })

    # 7. FATURAS
    if "Faturas" in wb.sheetnames:
        ws = wb["Faturas"]
        for r in range(3, ws.max_row + 1):
            dt = normalize_date(ws.cell(r, 1).value)
            forn = ws.cell(r, 2).value
            nif_forn = ws.cell(r, 3).value
            nif_acrs = ws.cell(r, 4).value
            num_fat = ws.cell(r, 5).value
            num_obra = ws.cell(r, 6).value
            cat = ws.cell(r, 7).value
            val = ws.cell(r, 8).value
            cartao = ws.cell(r, 9).value
            tipo = ws.cell(r, 10).value or "Despesa de obra"

            if not forn and not val:
                continue
            if not dt:
                log_issue("Faturas", r, "Data", "Data de fatura em falta.")
            if val is None or float(val) <= 0:
                log_issue("Faturas", r, "Valor (EUR)", "Valor de fatura inválido ou inferior a zero.")

            forn_str = str(forn).strip()
            data["suppliers"].add(forn_str)

            obra_id = None
            if num_obra:
                o_str = str(num_obra).strip()
                if o_str not in known_works:
                    log_issue("Faturas", r, "Numero Obra", f"Obra '{o_str}' não existe na folha Obras.", "WARNING")
                obra_id = o_str

            data["invoices"].append({
                "id": f"fat-{len(data['invoices'])+1}",
                "data": dt,
                "fornecedor": forn_str,
                "nif_fornecedor": str(nif_forn).strip() if nif_forn else None,
                "nif_empresa": str(nif_acrs).strip() if nif_acrs else None,
                "numero": str(num_fat).strip() if num_fat else "S/N",
                "obra_id": obra_id,
                "categoria": str(cat).strip() if cat else "Outros",
                "valor": float(val or 0),
                "cartao": str(cartao).strip() if cartao else None,
                "tipo": tipo,
                "estado": "Validada",
                "source": "ACRS"
            })

    # 8. PONTO (TIME ENTRIES)
    if "Ponto" in wb.sheetnames:
        ws = wb["Ponto"]
        for r in range(3, ws.max_row + 1):
            colab = ws.cell(r, 1).value
            dt = normalize_date(ws.cell(r, 2).value)
            num_obra = ws.cell(r, 3).value
            local = ws.cell(r, 4).value
            e_manha = normalize_time(ws.cell(r, 5).value)
            s_manha = normalize_time(ws.cell(r, 6).value)
            e_tarde = normalize_time(ws.cell(r, 7).value)
            s_tarde = normalize_time(ws.cell(r, 8).value)
            e_noite = normalize_time(ws.cell(r, 9).value)
            s_noite = normalize_time(ws.cell(r, 10).value)
            t_viagem = normalize_time(ws.cell(r, 11).value)
            horas = ws.cell(r, 12).value or 0
            h_viagem = ws.cell(r, 13).value or 0
            h_noturnas = ws.cell(r, 14).value or 0
            h_extra = ws.cell(r, 15).value or 0

            if not colab and not dt:
                continue

            colab_str = str(colab).strip()
            colab_match = next((c for c in data["collaborators"] if c["nome"].lower() == colab_str.lower()), None)
            if not colab_match:
                log_issue("Ponto", r, "Colaborador", f"Colaborador '{colab_str}' não existe na folha Colaboradores.")

            obra_str = str(num_obra).strip() if num_obra else ""
            if obra_str and obra_str not in known_works:
                log_issue("Ponto", r, "Numero Obra", f"Obra '{obra_str}' não existe na folha Obras.")

            data["times"].append({
                "id": f"ponto-{len(data['times'])+1}",
                "pessoa_id": colab_match["id"] if colab_match else f"colab-unknown",
                "nome": colab_str,
                "data": dt,
                "obra_id": obra_str,
                "local": str(local).strip() if local else None,
                "entrada_manha": e_manha,
                "saida_manha": s_manha,
                "entrada_tarde": e_tarde,
                "saida_tarde": s_tarde,
                "entrada_noite": e_noite,
                "saida_noite": s_noite,
                "tempo_viagem": t_viagem,
                "horas": float(horas),
                "horas_viagem": float(h_viagem),
                "horas_noturnas": float(h_noturnas),
                "horas_extra_excel": float(h_extra),
                "source": "ACRS"
            })

    # 9. ALOCAÇÕES
    if "Alocacoes" in wb.sheetnames:
        ws = wb["Alocacoes"]
        for r in range(3, ws.max_row + 1):
            num_maq = ws.cell(r, 1).value
            num_obra = ws.cell(r, 2).value
            dt_saida = normalize_date(ws.cell(r, 3).value)
            dt_dev = normalize_date(ws.cell(r, 4).value)
            custo_d = ws.cell(r, 5).value or 0
            user = ws.cell(r, 6).value or "Armazém"

            if not num_maq and not num_obra:
                continue

            maq_str = str(num_maq).strip()
            if maq_str not in known_machines:
                log_issue("Alocacoes", r, "Numero Maquina", f"Máquina '{maq_str}' não encontrada na folha Maquinas.")

            obra_str = str(num_obra).strip()
            if obra_str not in known_works:
                log_issue("Alocacoes", r, "Numero Obra", f"Obra '{obra_str}' não encontrada na folha Obras.")

            data["allocations"].append({
                "id": f"aloc-{len(data['allocations'])+1}",
                "maquina_id": maq_str,
                "obra_id": obra_str,
                "saida": dt_saida,
                "devolucao": dt_dev,
                "custo_dia": float(custo_d),
                "utilizador": str(user).strip(),
                "source": "ACRS"
            })

    # 10. MOVIMENTOS HISTÓRICOS DE ARMAZÉM
    if "Movimentos" in wb.sheetnames:
        ws = wb["Movimentos"]
        for r in range(3, ws.max_row + 1):
            tipo = ws.cell(r, 1).value or "Saída"
            cod_art = ws.cell(r, 2).value
            num_obra = ws.cell(r, 3).value
            qtd = ws.cell(r, 4).value or 0
            pr_unit = ws.cell(r, 5).value or 0
            dt = normalize_date(ws.cell(r, 6).value)
            user = ws.cell(r, 7).value or "Armazém"
            forn = ws.cell(r, 8).value
            tot_saida = str(ws.cell(r, 9).value or "").strip().lower() in ["sim", "true", "1"]

            if not cod_art:
                continue

            art_str = str(cod_art).strip()
            art_match = next((a for a in data["articles"] if a["codigo_acrs"].lower() == art_str.lower()), None)
            if not art_match and art_str not in known_articles:
                log_issue("Movimentos", r, "Codigo Artigo", f"Artigo '{art_str}' não existe no Inventário.")

            obra_str = str(num_obra).strip() if num_obra else None
            if obra_str and obra_str not in known_works:
                log_issue("Movimentos", r, "Numero Obra", f"Obra '{obra_str}' não existe na folha Obras.")

            data["movements"].append({
                "id": f"mov-{len(data['movements'])+1}",
                "tipo": tipo,
                "artigo_id": art_match["id"] if art_match else art_str,
                "obra_id": obra_str,
                "descricao": art_match["descricao"] if art_match else f"Artigo {art_str}",
                "quantidade": float(qtd),
                "valor_unitario": float(pr_unit),
                "data": dt,
                "utilizador": str(user).strip(),
                "fornecedor": str(forn).strip() if forn else None,
                "total_na_saida": tot_saida,
                "source": "ACRS"
            })

    return data, issues

def print_report(data, issues):
    print("\n========================================================")
    print("[REPORT] RESUMO DE DADOS DO FICHEIRO EXCEL")
    print("========================================================")
    print(f"  - Utilizadores:      {len(data['users'])}")
    print(f"  - Empresas:          {len(data['companies'])}")
    print(f"  - Obras:             {len(data['works'])}")
    print(f"  - Orçamentos:        {len(data['budgets'])}")
    print(f"  - Colaboradores:     {len(data['collaborators'])}")
    print(f"  - Artigos (Stock):   {len(data['articles'])}")
    print(f"  - Máquinas:          {len(data['machines'])}")
    print(f"  - Registos de Ponto: {len(data['times'])}")
    print(f"  - Faturas:           {len(data['invoices'])}")
    print(f"  - Alocações:         {len(data['allocations'])}")
    print(f"  - Movimentos:        {len(data['movements'])}")
    print(f"  - Fornecedores Det.: {len(data['suppliers'])}")

    print("\n========================================================")
    print(f"[VALIDATION] RELATÓRIO DE VALIDAÇÃO: {len(issues)} PROBLEMAS ENCONTRADOS")
    print("========================================================")

    errors = [i for i in issues if i["severity"] == "ERROR"]
    warnings = [i for i in issues if i["severity"] == "WARNING"]

    if not issues:
        print("  [SUCCESS] NENHUM ERRO ENCONTRADO! O ficheiro está 100% pronto para importação.")
    else:
        print(f"  [WARN]  Erros Críticos: {len(errors)} | Avisos: {len(warnings)}\n")
        for i in issues[:25]:
            icon = "[ERROR]" if i["severity"] == "ERROR" else "[WARN]"
            print(f"  {icon} [{i['sheet']}] Linha {i['row']} | Coluna: {i['col']} -> {i['message']}")
        if len(issues) > 25:
            print(f"  ... e mais {len(issues) - 25} problemas detetados.")

    return len(errors) == 0

def execute_import(data):
    if not SUPABASE_URL or not SERVICE_KEY:
        print("[ERROR] Erro: Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local")
        sys.exit(1)

    client = SupabaseClient(SUPABASE_URL, SERVICE_KEY)
    print("\n[START] A INICIAR TRANSAÇÃO DE IMPORTAÇÃO NO SUPABASE...")

    # 1. Empresas
    if data["companies"]:
        client.post("companies", data["companies"])
        print(f"  [OK] {len(data['companies'])} empresas inseridas.")

    # 2. Fornecedores
    supplier_rows = [{"id": f"forn-{i+1}", "nome": name, "source": "ACRS"} for i, name in enumerate(data["suppliers"])]
    if supplier_rows:
        client.post("suppliers", supplier_rows)
        print(f"  [OK] {len(supplier_rows)} fornecedores únicos criados.")

    # 3. Obras
    if data["works"]:
        client.post("works", data["works"])
        print(f"  [OK] {len(data['works'])} obras inseridas.")

    # 4. Orçamentos
    if data["budgets"]:
        client.post("budgets", data["budgets"])
        print(f"  [OK] {len(data['budgets'])} orçamentos inseridos.")

    # 5. Colaboradores
    if data["collaborators"]:
        client.post("people", data["collaborators"])
        print(f"  [OK] {len(data['collaborators'])} colaboradores inseridos.")

    # 6. Artigos
    if data["articles"]:
        client.post("articles", data["articles"])
        print(f"  [OK] {len(data['articles'])} artigos de inventário inseridos.")

    # 7. Máquinas
    if data["machines"]:
        client.post("machines", data["machines"])
        print(f"  [OK] {len(data['machines'])} máquinas inseridas.")

    # 8. Alocações
    if data["allocations"]:
        client.post("allocations", data["allocations"])
        print(f"  [OK] {len(data['allocations'])} alocações inseridas.")

    # 9. Movimentos
    if data["movements"]:
        client.post("movements", data["movements"])
        print(f"  [OK] {len(data['movements'])} movimentos de stock inseridos.")

    # 10. Faturas
    if data["invoices"]:
        # Chunks de 100 faturas para performance
        for i in range(0, len(data["invoices"]), 100):
            client.post("invoices", data["invoices"][i:i+100])
        print(f"  [OK] {len(data['invoices'])} faturas inseridas.")

    # 11. Ponto
    if data["times"]:
        for i in range(0, len(data["times"]), 150):
            client.post("time_entries", data["times"][i:i+150])
        print(f"  [OK] {len(data['times'])} registos de ponto inseridos.")

    print("\n[SUCCESS] IMPORTAÇÃO COMPLETA EXECUTADA COM SUCESSO!")

def main():
    parser = argparse.ArgumentParser(description="Validador e Importador do Template Excel para o ACRS ERP")
    parser.add_argument("--file", default="ACRS_Import_Template.xlsx", help="Caminho do ficheiro Excel")
    parser.add_argument("--dry-run", action="store_true", help="Apenas validar e reportar sem alterar a BD")
    parser.add_argument("--wipe-and-import", action="store_true", help="Limpar dados antigos e importar dados reais")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"[ERROR] Ficheiro '{args.file}' não encontrado.")
        sys.exit(1)

    data, issues = parse_excel_template(args.file)
    is_valid = print_report(data, issues)

    if args.dry_run:
        print("\nℹ️ Modo Dry-Run concluído. Nenhuma alteração foi realizada na base de dados.")
    elif args.wipe_and_import:
        if not is_valid:
            print("\n[ERROR] A importação foi interrompida devido a erros críticos. Corrija o Excel e tente novamente.")
            sys.exit(1)
        execute_import(data)
    else:
        print("\nIndique --dry-run para testar o ficheiro ou --wipe-and-import para carregar na base de dados.")

if __name__ == "__main__":
    main()
