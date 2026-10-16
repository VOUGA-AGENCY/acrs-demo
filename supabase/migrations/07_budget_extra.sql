-- Migration 07: Adicionar campo para orcamento extra / trabalhos adicionais
-- Atende ao requisito do CEO (Joao Catalao) - Ponto 8:
-- "Tem de haver um campo extra no orcamento para orcamento extra caso o cliente queira algum tipo de trabalho, mas que no fim va para o orcamento final."

ALTER TABLE budgets
ADD COLUMN IF NOT EXISTS valor_extra NUMERIC(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN budgets.valor_extra IS 'Valor comercial dos trabalhos adicionais / orcamento extra aprovado pelo cliente';
