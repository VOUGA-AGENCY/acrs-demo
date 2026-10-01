-- ============================================================================
-- ACRS DEMO V1 — MIGRAÇÃO 05: ALINHAMENTO COM TEMPLATE EXCEL (IMPORTAÇÃO REAL)
-- Adiciona campos dedicados para os 2 NIFs de fatura, inspeções de máquinas,
-- amortizações e regras operacionais de obras/empresas.
-- Totalmente compatível com a base de dados existente (IF NOT EXISTS).
-- ============================================================================

-- 1. FATURAS: Adicionar os 2 NIFs como colunas dedicadas de primeira classe
-- nif_empresa: NIF da ACRS (adquirente) para deduções fiscais / IRS / IRC
-- nif_fornecedor: NIF do emitente (restaurante, fornecedor, posto de combustível)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS nif_empresa TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS nif_fornecedor TEXT;

-- Retrocompatibilidade: preencher nif_fornecedor a partir de ocr_raw se existir
UPDATE invoices
SET nif_fornecedor = COALESCE(
  ocr_raw->>'nifFornecedor',
  ocr_raw->>'nif'
)
WHERE nif_fornecedor IS NULL
  AND ocr_raw IS NOT NULL
  AND (ocr_raw->>'nifFornecedor' IS NOT NULL OR ocr_raw->>'nif' IS NOT NULL);

-- 2. MÁQUINAS E EQUIPAMENTOS: Inspeções periódicas e dados de amortização
ALTER TABLE machines ADD COLUMN IF NOT EXISTS periodicidade_inspecao INTEGER;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS ultima_inspecao DATE;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS proxima_inspecao DATE;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS data_aquisicao DATE;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS periodo_amortizacao NUMERIC(5,2);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS valor_residual NUMERIC(12,2) DEFAULT 0;

-- 3. OBRAS: Regras operacionais de armazém e controlo de estaleiro
ALTER TABLE works ADD COLUMN IF NOT EXISTS quem_pode_movimentar TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS contentor_em_obra BOOLEAN DEFAULT false;

-- 4. EMPRESAS: NIF da empresa (interna ou subcontratada)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS nif TEXT;
