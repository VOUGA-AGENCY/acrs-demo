# ACRS — documentação de referência

Atualização documental: 14 de setembro de 2026. Destinatários: Miguel, Vasco e Patrick / Vouga Agency.

## Ler por esta ordem

1. [Contexto Operacional atualizado](ACRS___Contexto_Operacional.pdf) — 27 páginas: funcionamento atual, problemas, princípios e decisões ainda abertas.
2. [Caderno de Encargos — Demo V1](ACRS___Caderno_Encargos___DEMO.pdf) — 32 páginas: entrega funcional, permissões, backlog, marcos e aceitação.
3. [Análise funcional atualizada](analise-funcional.md) — leitura conjunta dos dois documentos e transição da demo frontend para a V1.
4. [Backlog, testes e plano da Demo V1](demo-v1-backlog-e-aceitacao.md) — guia de execução com referências às páginas físicas dos PDFs.
5. [Manual da demo frontend](manual-completo-sistema-demo.md) — fotografia do código inspecionado em 13/09; não certifica a implementação da V1.

Existem extrações textuais dos dois PDFs para pesquisa: [Contexto](ACRS___Contexto_Operacional.txt) e [Caderno](ACRS___Caderno_Encargos___DEMO.txt). As marcações «Página» referem-se à posição física no PDF, incluindo capa e índice.

## O que mudou

A primeira fase era uma demo frontend com estado local. O caderno agora define uma Demo V1 online, persistente e multiutilizador, com autenticação, permissões no backend, armazenamento privado de documentos e OCR real com validação humana. O objetivo continua a ser provar os circuitos fundamentais, não construir o ERP completo.

Os requisitos novos não são funcionalidades já implementadas. Esta atualização modifica apenas documentação; não altera código, infraestrutura ou dados.

## Precedência e interpretação

- O Caderno define o âmbito da Demo V1; o Contexto explica a operação e as regras do negócio.
- O Blueprint v0.1 e as análises anteriores são referências históricas, não justificam excluir persistência/OCR/permissões desta V1.
- Instruções explícitas de Miguel continuam a prevalecer sobre propostas dos documentos. Decisões anteriores compatíveis, como ausência de responsável na ficha da obra e o percurso de lista do tablet, não são revertidas por esta atualização.
- Regras que os PDFs assinalam «a confirmar» não passam a definitivas por já existirem parâmetros na demo.

## Documentos históricos e análises de dados

- [Blueprint v0.1](ACRS___Blueprint_Funcional_v0_1.pdf) e [texto](ACRS___Blueprint_Funcional_v0_1.txt): arquitetura anterior, mantida para consulta.
- [Estado de 11/09](estado-demo-v0.2.md): fotografia histórica.
- [Análise do Excel](analise-excel.md), [Power BI](analise-power-bi.md), [inventário](analise-inventario.md): análises das fontes então disponíveis; não substituem o caderno nem validam a proveniência dos ficheiros desta cópia.
- `historico/`: Contexto e análise funcional anteriores à presente revisão.

## Proveniência e distribuição

O Caderno foi localizado na pasta documental do projeto no Desktop, com o mesmo nome indicado por Miguel; o caminho inicialmente indicado em Downloads já não existia. Os PDFs copiados são preservados integralmente, sem edição do conteúdo. Ambos apresentam na capa a indicação «Confidential · For internal use only», aqui registada como classificação da fonte. Esta operação não faz commit, push ou publicação.

A presença de descrições de Excel/Power BI nestes PDFs não resolve, por si só, a dúvida anterior sobre a origem do Excel de teste. Validar a proveniência antes de uma migração; não assumir que todos os dados extraídos foram confirmados pela ACRS.
