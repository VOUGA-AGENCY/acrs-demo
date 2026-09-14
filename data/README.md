# Dados da demo ACRS

## Fontes reais
- `source/inventory.json`: todas as 485 linhas do PDF STOCK ARMAZEM MÊS AGOSTO, 9 páginas. Total 46.325,87 €. Códigos, descrições, marcas, quantidades, preços e localizações preservados. Vazios são `null`. O ID técnico identifica página/linha e não confunde variantes com código igual. Fonte identifica agosto, sem ano; não é inventário atual reconciliado. Unidades heterogéneas não se somam.
- `source/obras.json`, `pessoas.json`, `faturas.json`, `ponto.json`, `empresas.json`: extração do XLSM original, sem alterar o ficheiro. Referências à folha e linha permitem regressar à origem. Todas as dimensões disponíveis; factos das 12 obras selecionadas para a demo, incluindo 25094. O relatório `docs/analise-excel.md` documenta contagens, período e limitações.
- `source/excel-structure.json`: todas as 8 folhas, incluindo backup oculto, fórmulas e campos. `source/inventory-audit.json`: reconciliação integral do inventário.

## Convenção e transformações
`source: "ACRS"` identifica valores extraídos. Datas normalizadas para ISO, números em formato numérico JSON, identificadores como texto. Nenhuma data histórica é deslocada para simular atualidade. Nomes reais não são substituídos por fictícios. Os custos de mão de obra são uma estimativa calculada, não valores contabilísticos extraídos; a fórmula antiga de horas extra não é considerada política validada.

## Cenários demonstrativos
`demo/` contém orçamento, margem alvo, estados de obra, responsável, políticas de horas, mínimos, preços internos, máquinas e alocações/movimentos ilustrativos. Têm `source: "demo"`. Não existem orçamentos integrados nem cadastro de máquinas nos anexos. Relações pessoa–empresa sem evidência ficam por confirmar; não são inventadas como factos ACRS.

A aplicação mantém um único estado React em memória. Movimentos confirmados atualizam stock, obra e controlo na mesma sessão. Recarregar repõe o cenário inicial. Não há backend, armazenamento persistente, envio de documentos ou OCR. A escolha de ficheiro é local; o preenchimento de exemplo é explicitamente simulado.

## Limitações
O PBIX atual foi analisado fora do workspace; `docs/analise-power-bi.md` documenta as 6 páginas, 9 tabelas, 26 medidas e 10 relações ativas. `teste-fornecedor.xml` não pertence à ACRS, conforme confirmação posterior do utilizador. Está excluído de todos os dados, cálculos e interfaces da plataforma.

Preços internos, limites de horas extra, suplementos, inventário inicial e localizações em contentores continuam sujeitos a validação. Viaturas não têm custo diário nesta demo. Uma margem calculada sobre custos já registados não constitui projeção da margem final.
