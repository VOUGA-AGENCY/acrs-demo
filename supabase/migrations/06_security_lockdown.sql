-- ============================================================================
-- ACRS DEMO V1 — MIGRAÇÃO 06: BLOQUEIO DE SEGURANÇA E PRODUÇÃO (ZERO-TRUST)
-- Executa o Passo 2 do Plano de Segurança:
--   1. Revoga permissões em branco (blanket grants) do papel 'anon'.
--   2. Reescreve políticas RLS: elimina 'anon' e valida perfis reais em cada tabela.
--   3. Impede auto-escalação de privilégios (bloqueia alteração do próprio perfil).
--   4. Regra por obra: valida quem pode movimentar material (quem_pode_movimentar).
--   5. Torna o bucket 'documents' estritamente privado (signed URLs).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOGAR PRIVILÉGIOS GERAIS DO PAPEL ANÓNIMO (anon)
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- Conceder apenas USAGE de esquema para auth básica
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Utilizadores autenticados têm acesso padrão gerido por RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. FUNÇÃO SEGURA DE RESOLUÇÃO DO PERFIL DO UTILIZADOR
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_perfil()
RETURNS TEXT AS $$
  SELECT perfil FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT AS $$
  SELECT email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 3. TRIGGER ANTI-ESCALAÇÃO DE PRIVILÉGIOS EM PROFILES
-- Nenhum utilizador pode alterar o seu próprio perfil para 'admin'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_perfil_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.perfil IS DISTINCT FROM NEW.perfil THEN
    -- Apenas o service_role ou administradores existentes podem mudar o perfil
    IF (auth.jwt() ->> 'role') != 'service_role' AND public.current_user_perfil() != 'admin' THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o perfil de utilizador.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_perfil_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_perfil_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_perfil_escalation();

-- ----------------------------------------------------------------------------
-- 4. LIMPAR POLÍTICAS RLS ANTIGAS (DROP POLICIES)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'profiles', 'companies', 'works', 'budgets', 'articles', 'people', 
        'time_entries', 'machines', 'allocations', 'warehouse_operations', 
        'movements', 'invoices', 'invoice_items', 'audit_logs', 'settings', 
        'manual_costs', 'categories', 'suppliers'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. REESCREVER POLÍTICAS RLS ESTRITAS (APENAS AUTHENTICATED / ROLE-CHECK)
-- ----------------------------------------------------------------------------

-- PROFILES
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_self_or_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR current_user_perfil() = 'admin')
  WITH CHECK (user_id = auth.uid() OR current_user_perfil() = 'admin');

CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (current_user_perfil() = 'admin');

-- BUDGETS: Apenas administração tem acesso
CREATE POLICY "budgets_admin_only_select" ON budgets
  FOR SELECT TO authenticated
  USING (current_user_perfil() = 'admin');

CREATE POLICY "budgets_admin_only_manage" ON budgets
  FOR ALL TO authenticated
  USING (current_user_perfil() = 'admin')
  WITH CHECK (current_user_perfil() = 'admin');

-- WORKS: Todos autenticados consultam; apenas Admin gere
CREATE POLICY "works_select_authenticated" ON works
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "works_manage_admin" ON works
  FOR ALL TO authenticated
  USING (current_user_perfil() = 'admin')
  WITH CHECK (current_user_perfil() = 'admin');

-- ARTICLES: Todos consultam; Armazém e Admin gerem
CREATE POLICY "articles_select_authenticated" ON articles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "articles_manage_warehouse_admin" ON articles
  FOR ALL TO authenticated
  USING (current_user_perfil() IN ('admin', 'armazem'))
  WITH CHECK (current_user_perfil() IN ('admin', 'armazem'));

-- MOVEMENTS: Regra estrita de quem pode movimentar materiais
CREATE POLICY "movements_select_authenticated" ON movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "movements_insert_authorized" ON movements
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Armazém e Admin podem sempre registar movimentos
    current_user_perfil() IN ('admin', 'armazem')
    -- Ou utilizadores autorizados na própria obra
    OR (
      obra_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM works w
        JOIN profiles p ON p.user_id = auth.uid()
        WHERE w.id = movements.obra_id
          AND (
            w.quem_pode_movimentar IS NULL
            OR w.quem_pode_movimentar = ''
            OR w.quem_pode_movimentar ILIKE ('%' || p.email || '%')
            OR w.quem_pode_movimentar ILIKE ('%' || p.nome || '%')
          )
      )
    )
  );

CREATE POLICY "movements_update_delete_admin" ON movements
  FOR UPDATE TO authenticated
  USING (current_user_perfil() = 'admin');

-- WAREHOUSE OPERATIONS
CREATE POLICY "warehouse_ops_select" ON warehouse_operations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "warehouse_ops_manage" ON warehouse_operations
  FOR ALL TO authenticated
  USING (current_user_perfil() IN ('admin', 'armazem'))
  WITH CHECK (current_user_perfil() IN ('admin', 'armazem'));

-- MACHINES & ALLOCATIONS
CREATE POLICY "machines_select_authenticated" ON machines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "machines_manage_admin_warehouse" ON machines
  FOR ALL TO authenticated
  USING (current_user_perfil() IN ('admin', 'armazem'))
  WITH CHECK (current_user_perfil() IN ('admin', 'armazem'));

CREATE POLICY "allocations_select_authenticated" ON allocations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allocations_manage_admin_warehouse" ON allocations
  FOR ALL TO authenticated
  USING (current_user_perfil() IN ('admin', 'armazem'))
  WITH CHECK (current_user_perfil() IN ('admin', 'armazem'));

-- INVOICES: Terreno submete; Secretariado/Admin valida
CREATE POLICY "invoices_select_authenticated" ON invoices
  FOR SELECT TO authenticated
  USING (
    current_user_perfil() IN ('admin', 'secretariado')
    OR (current_user_perfil() = 'terreno' AND utilizador = current_user_email())
    OR (current_user_perfil() = 'armazem' AND tipo = 'Compra para stock')
  );

CREATE POLICY "invoices_insert_authenticated" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "invoices_update_validation" ON invoices
  FOR UPDATE TO authenticated
  USING (current_user_perfil() IN ('admin', 'secretariado'))
  WITH CHECK (current_user_perfil() IN ('admin', 'secretariado'));

CREATE POLICY "invoice_items_manage" ON invoice_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- PEOPLE & TIME ENTRIES
CREATE POLICY "people_select_authenticated" ON people
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "people_manage_admin" ON people
  FOR ALL TO authenticated
  USING (current_user_perfil() = 'admin')
  WITH CHECK (current_user_perfil() = 'admin');

CREATE POLICY "companies_select_authenticated" ON companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "companies_manage_admin" ON companies
  FOR ALL TO authenticated
  USING (current_user_perfil() = 'admin')
  WITH CHECK (current_user_perfil() = 'admin');

CREATE POLICY "time_entries_select_authenticated" ON time_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "time_entries_manage_secretariado_admin" ON time_entries
  FOR ALL TO authenticated
  USING (current_user_perfil() IN ('admin', 'secretariado'))
  WITH CHECK (current_user_perfil() IN ('admin', 'secretariado'));

-- AUDIT LOGS: Escrita permitida a utilizadores autenticados; Consulta apenas a Admin e Secretariado
CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "audit_logs_select_admin_secretariado" ON audit_logs
  FOR SELECT TO authenticated
  USING (current_user_perfil() IN ('admin', 'secretariado'));

-- SETTINGS & MANUAL COSTS
CREATE POLICY "settings_select_authenticated" ON settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "settings_manage_admin" ON settings
  FOR ALL TO authenticated
  USING (current_user_perfil() = 'admin')
  WITH CHECK (current_user_perfil() = 'admin');

CREATE POLICY "manual_costs_select" ON manual_costs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "manual_costs_manage" ON manual_costs
  FOR ALL TO authenticated
  USING (current_user_perfil() IN ('admin', 'secretariado'))
  WITH CHECK (current_user_perfil() IN ('admin', 'secretariado'));

-- TABELAS AUXILIARES
CREATE POLICY "categories_select" ON categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_manage" ON categories
  FOR ALL TO authenticated
  USING (current_user_perfil() = 'admin');

CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "suppliers_manage" ON suppliers
  FOR ALL TO authenticated
  USING (current_user_perfil() IN ('admin', 'secretariado'));

-- ----------------------------------------------------------------------------
-- 6. SUPABASE STORAGE (BUCKET 'documents' PRIVADO)
-- Torna o bucket estritamente privado e acessível apenas via URLs assinados
-- ----------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'documents';

-- Limpar políticas antigas de storage
DROP POLICY IF EXISTS "Permitir upload de documentos de fatura" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura de documentos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir gestão de documentos" ON storage.objects;

-- Upload restrito a utilizadores autenticados
CREATE POLICY "storage_documents_upload_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- Leitura restrita a utilizadores autenticados
CREATE POLICY "storage_documents_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- Eliminação / Gestão restrita a Administradores
CREATE POLICY "storage_documents_manage_admin"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'documents' AND public.current_user_perfil() = 'admin');
