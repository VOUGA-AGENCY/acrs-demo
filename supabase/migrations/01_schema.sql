-- ============================================================================
-- ACRS DEMO V1 — ESQUEMA COMPLETO DE BASE DE DADOS (SUPABASE / POSTGRESQL)
-- Modelado a partir de:
--   - ACRS_Data_Input.xlsm (Ponto, Faturas, Colaboradores, Lista Obras, Tabelas Apoio)
--   - STOCK ARMAZEM MÊS AGOSTO.pdf (485 artigos de inventário e variantes)
--   - ACRS Metal Solution_Dashboard.pbix (9 tabelas e 26 medidas analíticas)
--   - ACRS Caderno de Encargos Demo V1
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PERFIS DE UTILIZADOR
-- 4 perfis reais com controlo de acesso: admin, secretariado, armazem, terreno
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT UNIQUE,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'secretariado', 'armazem', 'terreno')),
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. EMPRESAS (Interna vs Subcontratadas A, B, C, D)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Interna', 'Subcontratada')),
  source TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. OBRAS (Origem: Master_Obras do PBIX / Lista Obras do Excel)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL,
  nome TEXT NOT NULL,
  local TEXT,
  cliente TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Em curso',
  data_inicio DATE,
  data_fim DATE,
  source TEXT NOT NULL DEFAULT 'ACRS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. ORÇAMENTOS E MARGEM (Sensível: Restrito a Administração via RLS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets (
  obra_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  margem NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  modo TEXT NOT NULL DEFAULT 'Simples' CHECK (modo IN ('Simples', 'Discriminado')),
  linhas JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. ARTIGOS / INVENTÁRIO (Origem: STOCK ARMAZEM MÊS AGOSTO.pdf - 485 artigos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  codigo_acrs TEXT NOT NULL,
  familia TEXT NOT NULL,
  material TEXT,
  tamanho TEXT,
  descricao TEXT NOT NULL,
  marca TEXT,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 0,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  localizacao TEXT NOT NULL DEFAULT 'ARMAZÉM',
  unidade TEXT NOT NULL DEFAULT 'un.',
  precisao INTEGER NOT NULL DEFAULT 0,
  minimo NUMERIC(12,3) DEFAULT 0,
  valor_interno NUMERIC(12,2) DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'ACRS',
  source_page INTEGER,
  source_row INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. COLABORADORES (Origem: Master_Colaboradores do PBIX / Lista Pessoas Excel)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  custo_hora NUMERIC(10,2),
  horas_dia NUMERIC(6,2),
  entrada_normal TIME DEFAULT '08:00',
  saida_normal TIME DEFAULT '17:00',
  inicio_noturno TIME DEFAULT '22:00',
  fim_noturno TIME DEFAULT '07:00',
  suplemento_extra NUMERIC(5,2) DEFAULT 0.50,
  suplemento_noturno NUMERIC(5,2) DEFAULT 0.25,
  elegivel_extra BOOLEAN DEFAULT true,
  empresa_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  tipo TEXT,
  source TEXT NOT NULL DEFAULT 'ACRS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. PONTO / HORAS DE TRABALHO (Origem: Dados_Ponto do PBIX / Ponto do Excel)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  pessoa_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  obra_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  local TEXT,
  entrada_manha TEXT,
  saida_manha TEXT,
  entrada_tarde TEXT,
  saida_tarde TEXT,
  entrada_noite TEXT,
  saida_noite TEXT,
  tempo_viagem TEXT,
  horas NUMERIC(6,2) NOT NULL DEFAULT 0,
  horas_viagem NUMERIC(6,2) NOT NULL DEFAULT 0,
  horas_noturnas NUMERIC(6,2) NOT NULL DEFAULT 0,
  horas_extra_excel NUMERIC(6,2) NOT NULL DEFAULT 0,
  registado_em TIMESTAMPTZ DEFAULT now(),
  utilizador TEXT,
  source TEXT NOT NULL DEFAULT 'ACRS',
  source_ref JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. MÁQUINAS E EQUIPAMENTOS (Ferramentaria)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Disponível' CHECK (estado IN ('Disponível', 'Em obra', 'Em reparação', 'Indisponível', 'Manutenção')),
  custo_dia NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo_interno_dia NUMERIC(10,2),
  custo_aquisicao NUMERIC(12,2),
  manutencao_acumulada NUMERIC(12,2) DEFAULT 0,
  tipo TEXT NOT NULL CHECK (tipo IN ('Máquina', 'Caixa')),
  source TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 9. ALOCAÇÕES DE EQUIPAMENTOS A OBRAS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  maquina_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  obra_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  saida DATE NOT NULL,
  devolucao DATE,
  custo_dia NUMERIC(10,2) NOT NULL,
  utilizador TEXT NOT NULL,
  registado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 10. OPERAÇÕES DE ARMAZÉM (Identificador agrupador de saída, ex: SAIDA-2026-000184)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_operations (
  id TEXT PRIMARY KEY,
  numero_operacao TEXT NOT NULL UNIQUE,
  obra_id TEXT REFERENCES works(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Saída', 'Entrada', 'Devolução', 'Ajuste')),
  data DATE NOT NULL,
  utilizador TEXT NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 11. MOVIMENTOS DE STOCK DO ARMAZÉM
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  operacao_id TEXT REFERENCES warehouse_operations(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Saída', 'Devolução', 'Entrada', 'Outro')),
  artigo_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  obra_id TEXT REFERENCES works(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL,
  valor_unitario NUMERIC(12,2) NOT NULL,
  data DATE NOT NULL,
  registado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  utilizador TEXT NOT NULL,
  origem_id TEXT,
  total_na_saida BOOLEAN NOT NULL DEFAULT false,
  fornecedor TEXT,
  source TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 12. FATURAS E DOCUMENTOS (Origem: Dados_Faturas PBIX / Faturas Excel + OCR)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  data DATE NOT NULL,
  fornecedor TEXT NOT NULL,
  numero TEXT,
  obra_id TEXT REFERENCES works(id) ON DELETE SET NULL,
  categoria TEXT,
  valor NUMERIC(12,2) NOT NULL,
  cartao TEXT,
  estado TEXT NOT NULL DEFAULT 'Por validar' CHECK (estado IN ('Rascunho', 'Por validar', 'Validada', 'Rejeitada')),
  tipo TEXT NOT NULL DEFAULT 'Despesa de obra' CHECK (tipo IN ('Despesa de obra', 'Compra para stock')),
  documento_url TEXT,
  artigo_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  quantidade NUMERIC(12,3),
  ocr_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (ocr_status IN ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'CONFIRMED', 'OCR_FAILED', 'MANUAL')),
  ocr_raw JSONB,
  ocr_confidence NUMERIC(5,2),
  registado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  utilizador TEXT,
  validado_em TIMESTAMPTZ,
  validado_por TEXT,
  rejeitado_em TIMESTAMPTZ,
  rejeitado_por TEXT,
  source TEXT NOT NULL DEFAULT 'demo',
  source_ref JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 13. LINHAS DE FATURA (Para faturas multilinha e compras para stock)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_taxa NUMERIC(5,2) DEFAULT 23.00,
  artigo_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 14. AUDITORIA TRANSVERSAL (Rastreabilidade mínima do Caderno de Encargos)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilizador TEXT NOT NULL,
  perfil TEXT,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  estado_anterior JSONB,
  estado_posterior JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 15. CONFIGURAÇÕES E POLÍTICAS DE CUSTO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  minimos JSONB NOT NULL DEFAULT '{}'::jsonb,
  valores_internos JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy JSONB NOT NULL DEFAULT '{
    "limiteExtra": 8,
    "extra": 0.5,
    "noturno": 0.25,
    "sabado": 0.5,
    "domingo": 0.5,
    "feriado": 0.5,
    "acumular": false,
    "source": "demo"
  }'::jsonb,
  person_policies JSONB NOT NULL DEFAULT '{}'::jsonb,
  company_policies JSONB NOT NULL DEFAULT '{}'::jsonb,
  holidays JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 16. CUSTOS MANUAIS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_costs (
  id TEXT PRIMARY KEY,
  obra_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  registado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  origem TEXT NOT NULL DEFAULT 'Manual',
  origem_id TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  utilizador TEXT NOT NULL,
  nota TEXT,
  source TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 17. ÍNDICES DE PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_works_numero ON works(numero);
CREATE INDEX IF NOT EXISTS idx_time_entries_obra_data ON time_entries(obra_id, data);
CREATE INDEX IF NOT EXISTS idx_time_entries_pessoa_data ON time_entries(pessoa_id, data);
CREATE INDEX IF NOT EXISTS idx_movements_artigo ON movements(artigo_id);
CREATE INDEX IF NOT EXISTS idx_movements_obra ON movements(obra_id);
CREATE INDEX IF NOT EXISTS idx_invoices_obra ON invoices(obra_id);
CREATE INDEX IF NOT EXISTS idx_invoices_estado ON invoices(estado);
CREATE INDEX IF NOT EXISTS idx_allocations_maquina ON allocations(maquina_id);
CREATE INDEX IF NOT EXISTS idx_allocations_obra ON allocations(obra_id);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON audit_logs(entidade, entidade_id);

-- ----------------------------------------------------------------------------
-- 18. VISTA CENTRAL: LIVRO CENTRAL DE CUSTOS (cost_ledger_view)
-- Une faturas validadas, mão de obra apurada, saídas de armazém e alocações
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW cost_ledger_view AS
-- 1. Faturas validadas de despesa direta
SELECT 
  'cost-' || i.id AS id,
  i.obra_id AS obra_id,
  i.data AS data,
  i.registado_em AS registado_em,
  'Fatura' AS origem,
  i.id AS origem_id,
  i.fornecedor || ' · ' || i.numero AS descricao,
  COALESCE(i.categoria, 'Outros') AS categoria,
  1.0 AS quantidade,
  i.valor AS valor_unitario,
  i.valor AS valor,
  COALESCE(i.utilizador, 'Demo') AS utilizador,
  i.source AS source
FROM invoices i
WHERE i.estado = 'Validada' AND i.tipo = 'Despesa de obra' AND i.obra_id IS NOT NULL

UNION ALL

-- 2. Movimentos de materiais e consumíveis
SELECT 
  'cost-' || m.id AS id,
  m.obra_id AS obra_id,
  m.data AS data,
  m.registado_em AS registado_em,
  CASE WHEN m.tipo = 'Outro' THEN 'Manual' ELSE 'Armazém' END AS origem,
  m.id AS origem_id,
  m.descricao AS descricao,
  'Materiais' AS categoria,
  m.quantidade AS quantidade,
  m.valor_unitario AS valor_unitario,
  ROUND((m.quantidade * m.valor_unitario * (CASE WHEN m.tipo = 'Devolução' THEN -1 ELSE 1 END))::numeric, 2) AS valor,
  m.utilizador AS utilizador,
  m.source AS source
FROM movements m
WHERE m.tipo IN ('Saída', 'Devolução', 'Outro') AND m.obra_id IS NOT NULL

UNION ALL

-- 3. Custos manuais
SELECT 
  'cost-' || mc.id AS id,
  mc.obra_id AS obra_id,
  mc.data AS data,
  mc.registado_em AS registado_em,
  mc.origem AS origem,
  mc.origem_id AS origem_id,
  mc.descricao AS descricao,
  mc.categoria AS categoria,
  mc.quantidade AS quantidade,
  mc.valor_unitario AS valor_unitario,
  mc.valor AS valor,
  mc.utilizador AS utilizador,
  mc.source AS source
FROM manual_costs mc;

-- ----------------------------------------------------------------------------
-- 19. PERMISSÕES DE PAPEL (GRANTS)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role, authenticated, anon;
