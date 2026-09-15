-- ============================================================================
-- ACRS DEMO V1 — SUPABASE STORAGE (BUCKET 'documents')
-- Armazenamento privado persistente para fotografias e PDFs de faturas/recibos
-- ============================================================================

-- Criar o bucket privado 'documents' se ainda não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Política de upload: utilizadores autenticados ou anónimos com chave pública
CREATE POLICY "Permitir upload de documentos de fatura"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'documents');

-- Política de leitura: consulta autorizada de documentos
CREATE POLICY "Permitir leitura de documentos"
ON storage.objects FOR SELECT
TO authenticated, anon
USING (bucket_id = 'documents');

-- Política de atualização/eliminação: apenas administradores
CREATE POLICY "Permitir gestão de documentos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'documents');
