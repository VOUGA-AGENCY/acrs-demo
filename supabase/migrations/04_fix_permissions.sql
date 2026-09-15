-- ============================================================================
-- ACRS DEMO V1 — CONCESSÃO DE PERMISSÕES (GRANTS) E POLÍTICAS DE SEED
-- Executar no SQL Editor do Supabase para corrigir o erro 42501 (permission denied)
-- ============================================================================

-- 1. ATUALIZAR RESTRIÇÃO DE ESTADO DAS MÁQUINAS E NÚMERO DE FATURA
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_estado_check;
ALTER TABLE machines ADD CONSTRAINT machines_estado_check 
  CHECK (estado IN ('Disponível', 'Em obra', 'Em reparação', 'Indisponível', 'Manutenção'));

ALTER TABLE invoices ALTER COLUMN numero DROP NOT NULL;

-- Criar tabelas de apoio de Categorias e Fornecedores
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ACRS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ACRS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- 2. CONCEDER PRIVILÉGIOS DE TABELA AOS PAPÉIS DO SUPABASE
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, anon;

-- 2. GARANTIR PRIVILÉGIOS EM FUTURAS TABELAS
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role, authenticated, anon;

-- 3. POLÍTICAS ADICIONAIS PARA PERMITIR O POVOAMENTO (SEED)
DO $$
BEGIN
  -- companies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Permitir gestão de empresas para seed') THEN
    CREATE POLICY "Permitir gestão de empresas para seed" ON companies FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- works
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'works' AND policyname = 'Permitir gestão de obras para seed') THEN
    CREATE POLICY "Permitir gestão de obras para seed" ON works FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- articles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'articles' AND policyname = 'Permitir gestão de artigos para seed') THEN
    CREATE POLICY "Permitir gestão de artigos para seed" ON articles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- people
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'people' AND policyname = 'Permitir gestão de pessoas para seed') THEN
    CREATE POLICY "Permitir gestão de pessoas para seed" ON people FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- time_entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_entries' AND policyname = 'Permitir gestão de ponto para seed') THEN
    CREATE POLICY "Permitir gestão de ponto para seed" ON time_entries FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- machines
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'machines' AND policyname = 'Permitir gestão de máquinas para seed') THEN
    CREATE POLICY "Permitir gestão de máquinas para seed" ON machines FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Permitir gestão de perfis para seed') THEN
    CREATE POLICY "Permitir gestão de perfis para seed" ON profiles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- budgets (permitir insert de seed)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Permitir insert de orçamentos para seed') THEN
    CREATE POLICY "Permitir insert de orçamentos para seed" ON budgets FOR INSERT TO authenticated, anon WITH CHECK (true);
  END IF;

  -- categories
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Permitir gestão de categorias para seed') THEN
    CREATE POLICY "Permitir gestão de categorias para seed" ON categories FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- suppliers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Permitir gestão de fornecedores para seed') THEN
    CREATE POLICY "Permitir gestão de fornecedores para seed" ON suppliers FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;
