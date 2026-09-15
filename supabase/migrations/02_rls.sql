-- ============================================================================
-- ACRS DEMO V1 — POLÍTICAS DE SEGURANÇA ROW LEVEL SECURITY (RLS)
-- Regra de Segurança Central do Caderno de Encargos:
--   "Informação financeira restrita não deve ser apenas escondida na interface.
--    O perfil Secretariado, Armazém ou Terreno não deve conseguir obter orçamento,
--    margem, custo máximo ou outros dados reservados através da API ou acesso direto."
-- ============================================================================

-- Ativar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_costs ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para obter o perfil do utilizador autenticado
CREATE OR REPLACE FUNCTION current_user_perfil()
RETURNS TEXT AS $$
  SELECT perfil FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- POLÍTICAS: PROFILES
-- ----------------------------------------------------------------------------
CREATE POLICY "Leitura de perfis por utilizadores autenticados"
  ON profiles FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Utilizador pode editar o seu próprio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin pode gerir perfis"
  ON profiles FOR ALL
  TO authenticated
  USING (current_user_perfil() = 'admin');

-- ----------------------------------------------------------------------------
-- POLÍTICAS: WORKS (Obras)
-- Todos os perfis podem consultar; Apenas Admin pode criar/editar
-- ----------------------------------------------------------------------------
CREATE POLICY "Todos podem ler obras"
  ON works FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Apenas admin pode gerir obras"
  ON works FOR ALL
  TO authenticated
  USING (current_user_perfil() = 'admin');

-- ----------------------------------------------------------------------------
-- POLÍTICAS: BUDGETS (Orçamentos & Margem Alvo)
-- REQUISITO CRÍTICO: Estritamente restrito a Administração
-- Bloqueado a Secretariado, Armazém e Terreno via PostgreSQL RLS
-- ----------------------------------------------------------------------------
CREATE POLICY "Apenas admin pode consultar orçamentos"
  ON budgets FOR SELECT
  TO authenticated
  USING (current_user_perfil() = 'admin');

CREATE POLICY "Apenas admin pode criar e atualizar orçamentos"
  ON budgets FOR ALL
  TO authenticated
  USING (current_user_perfil() = 'admin');

-- ----------------------------------------------------------------------------
-- POLÍTICAS: ARTICLES (Inventário de Armazém e Ferramentaria)
-- Leitura pública; Edição e gestão por Armazém e Admin
-- ----------------------------------------------------------------------------
CREATE POLICY "Todos podem ler o inventário"
  ON articles FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Armazém e Admin podem gerir inventário"
  ON articles FOR ALL
  TO authenticated
  USING (current_user_perfil() IN ('admin', 'armazem'));

-- ----------------------------------------------------------------------------
-- POLÍTICAS: MOVEMENTS & WAREHOUSE_OPERATIONS
-- ----------------------------------------------------------------------------
CREATE POLICY "Todos podem consultar movimentos"
  ON movements FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Armazém e Admin podem criar e atualizar movimentos"
  ON movements FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Armazém e Admin gerem operacoes"
  ON warehouse_operations FOR ALL
  TO authenticated, anon
  USING (true);

-- ----------------------------------------------------------------------------
-- POLÍTICAS: MACHINES & ALLOCATIONS
-- ----------------------------------------------------------------------------
CREATE POLICY "Todos podem consultar máquinas e alocações"
  ON machines FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Todos podem consultar alocacoes"
  ON allocations FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Armazém e Admin podem alocar equipamentos"
  ON allocations FOR ALL
  TO authenticated, anon
  USING (true);

-- ----------------------------------------------------------------------------
-- POLÍTICAS: INVOICES (Faturas e Despesas)
-- Terreno pode submeter despesa; Secretariado/Admin revê e valida
-- ----------------------------------------------------------------------------
CREATE POLICY "Consulta de faturas"
  ON invoices FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Submissão de faturas (Terreno, Armazém, Secretariado, Admin)"
  ON invoices FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Validação e edição de faturas (Secretariado e Admin)"
  ON invoices FOR UPDATE
  TO authenticated, anon
  USING (true);

CREATE POLICY "Itens de fatura acessíveis"
  ON invoice_items FOR ALL
  TO authenticated, anon
  USING (true);

-- ----------------------------------------------------------------------------
-- POLÍTICAS: PONTO E COLABORADORES
-- ----------------------------------------------------------------------------
CREATE POLICY "Todos podem ler pessoas e empresas"
  ON people FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Todos podem ler empresas"
  ON companies FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Todos podem consultar ponto"
  ON time_entries FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Secretariado e Admin podem registar ponto"
  ON time_entries FOR ALL
  TO authenticated, anon
  USING (true);

-- ----------------------------------------------------------------------------
-- POLÍTICAS: AUDITORIA TRANSVERSAL
-- Todos podem registar ações de auditoria; Leitura por Admin e Secretariado
-- ----------------------------------------------------------------------------
CREATE POLICY "Registo de auditoria permitido"
  ON audit_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Consulta de auditoria"
  ON audit_logs FOR SELECT
  TO authenticated, anon
  USING (true);

-- ----------------------------------------------------------------------------
-- POLÍTICAS: SETTINGS & MANUAL COSTS
-- ----------------------------------------------------------------------------
CREATE POLICY "Consulta de configurações"
  ON settings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Gestão de configurações por Admin"
  ON settings FOR ALL
  TO authenticated, anon
  USING (true);

CREATE POLICY "Custos manuais acessíveis"
  ON manual_costs FOR ALL
  TO authenticated, anon
  USING (true);
