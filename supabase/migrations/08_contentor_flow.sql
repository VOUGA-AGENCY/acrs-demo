-- Migration 08: Suporte ao fluxo de contentores em obra e permissoes de movimentacao
-- Atende aos requisitos do CEO (Joao Catalao) - Pontos 1 e 2:
-- 1. Transferencias do armazem central: ferramentaria/admin
--    Contentor em obra: encarregado/responsavel designado da obra
-- 2. Material Armazem -> Contentor: sai do stock central, fica pendente/disponivel no contentor, SEM CUSTO na obra.
--    Material Contentor -> Obra (Consumo): gera custo na obra.

-- 1. Atualizar constraint de tipo de movimento
ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_tipo_check;

ALTER TABLE movements ADD CONSTRAINT movements_tipo_check 
  CHECK (tipo IN (
    'Saída',
    'Devolução',
    'Entrada',
    'Outro',
    'Transferência Contentor',
    'Consumo Contentor',
    'Retorno Contentor'
  ));

-- 2. Atualizar cost_ledger_view
-- Drop da vista para evitar erro 42P16 (cannot change data type of view column)
DROP VIEW IF EXISTS cost_ledger_view CASCADE;

CREATE VIEW cost_ledger_view AS
-- 1. Faturas validadas de despesa direta
SELECT 
  'cost-' || i.id AS id,
  i.obra_id AS obra_id,
  i.data AS data,
  i.registado_em AS registado_em,
  'Fatura' AS origem,
  i.id AS origem_id,
  i.fornecedor || ' - ' || i.numero AS descricao,
  COALESCE(i.categoria, 'Outros') AS categoria,
  COALESCE(i.quantidade, 1)::numeric(12,3) AS quantidade,
  ROUND((i.valor / NULLIF(COALESCE(i.quantidade, 1), 0))::numeric, 2)::numeric(12,2) AS valor_unitario,
  i.valor::numeric(14,2) AS valor,
  i.utilizador AS utilizador,
  i.source AS source
FROM invoices i
WHERE i.estado = 'Validada' AND i.tipo = 'Despesa de obra' AND i.obra_id IS NOT NULL

UNION ALL

-- 2. Movimentos de materiais que imputam custo (Saida direta, Consumo de Contentor, Outro) ou credito (Devolucao)
-- Note: 'Transferência Contentor' e 'Retorno Contentor' NAO geram custo na obra
SELECT 
  'cost-' || m.id AS id,
  m.obra_id AS obra_id,
  m.data AS data,
  m.registado_em AS registado_em,
  CASE 
    WHEN m.tipo = 'Consumo Contentor' THEN 'Contentor'
    WHEN m.tipo = 'Outro' THEN 'Manual'
    ELSE 'Armazém'
  END AS origem,
  m.id AS origem_id,
  m.descricao AS descricao,
  'Materiais' AS categoria,
  m.quantidade::numeric(12,3) AS quantidade,
  m.valor_unitario::numeric(12,2) AS valor_unitario,
  ROUND((m.quantidade * m.valor_unitario * CASE WHEN m.tipo = 'Devolução' THEN -1 ELSE 1 END)::numeric, 2)::numeric(14,2) AS valor,
  m.utilizador AS utilizador,
  m.source AS source
FROM movements m
WHERE m.tipo IN ('Saída', 'Consumo Contentor', 'Devolução', 'Outro') AND m.obra_id IS NOT NULL

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
  mc.quantidade::numeric(12,3) AS quantidade,
  mc.valor_unitario::numeric(12,2) AS valor_unitario,
  mc.valor::numeric(14,2) AS valor,
  mc.utilizador AS utilizador,
  mc.source AS source
FROM manual_costs mc;

-- 3. Restaurar permissoes de leitura na vista
GRANT SELECT ON cost_ledger_view TO authenticated, anon, service_role;
