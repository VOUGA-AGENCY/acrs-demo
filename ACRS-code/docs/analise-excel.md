# Análise do Excel operacional e do XML

> **Enquadramento atualizado em 14/09/2026:** este documento preserva a análise histórica da demo/fontes, não o estado de conclusão da Demo V1. Para o âmbito vigente, ler o [índice documental](README.md), o [Caderno](ACRS___Caderno_Encargos___DEMO.pdf) e a [análise funcional atualizada](analise-funcional.md). Persistência, quatro perfis reais, permissões no backend e OCR fazem agora parte da entrega V1. As regras ainda por confirmar nos novos PDFs continuam pendentes.

Fonte: `data/ACRS_Data_Input.xlsm`. Inspeção integral das oito folhas, valores guardados, fórmulas, tabelas, nomes definidos, ligações externas e presença de macros. O ficheiro original não foi alterado e nenhuma macro foi executada.

## Estrutura e relações

| Folha | Conteúdo efetivo | Papel |
|---|---:|---|
| Menu | 2 linhas com conteúdo numa área de 31 linhas | Entrada para a utilização do ficheiro/macros |
| Ponto | 8 905 registos, tabela `Table1!A1:N8906` | Pessoa, data, três intervalos horários, obra, local e viagem; três colunas calculadas |
| Faturas | 4 244 registos, tabela `Faturas!A1:G4245` | Data, fornecedor, número, obra, categoria, valor e identificador interno de cartão |
| Colaboradores | 201 pessoas | Lista ordenada, preço/hora, horas/dia, janelas horárias e suplementos |
| Lista Pessoas | 201 pessoas | Lista dinâmica proveniente do ponto, preços/hora e indicador de elegibilidade de extra |
| Lista Obras | 183 linhas, 177 rótulos distintos | Lista dinâmica de combinações obra/local provenientes do ponto |
| Tabelas Apoio | 4 horários, 45 categorias, 188 entradas de fornecedores, lista dinâmica de cartões | Seletores e parametrização auxiliar |
| Lista Pessoas (backup) | 38 linhas com conteúdo, incluindo cabeçalho; folha oculta | Cópia antiga de parâmetros; não usada como dimensão atual |

As tabelas de apoio são `Tabela_Horario!A1:E5`, `Categoria!H1:H46` e `Fornecedores!J1:J189`. O livro contém `vbaProject.bin`, mas não ligações externas nem ficheiros de consulta/conexão. A análise incidiu sobre os dados e fórmulas guardados, sem executar a automação VBA.

O ponto alimenta as listas de pessoas e obras. A lista de pessoas alimenta a lista ordenada de colaboradores e as regras de extra do ponto. As faturas usam número de obra como relação, mas também contêm obras não presentes no ponto. A união preservada contém **240 referências de obra**. Isto não equivale a 240 fichas de obra validadas: há códigos apenas presentes nas faturas, referências compostas e possíveis erros de introdução.

O campo depois de ` - ` em Lista Obras é **Local**. Não há evidência para o transformar automaticamente num cliente formal. O Excel também não fornece responsável, estado de obra, orçamento, margem alvo, estado de validação de fatura, empresa empregadora da pessoa nem classificação ACRS/subcontratado. Esses campos pertencem à camada demo ou à informação confirmada do levantamento.

## Fórmulas e perguntas de gestão

Foram inspecionadas 26 715 fórmulas no Ponto, correspondentes a três fórmulas por registo, e quatro fórmulas matriciais nas listas auxiliares. Não foram encontrados erros Excel guardados como `#REF!`, `#VALUE!` ou equivalentes.

- **Total horas:** soma dos três intervalos, usando diferença modular para permitir passagem da meia-noite. A extração comparou as durações dos intervalos com as horas em cache em todos os 8 905 registos; não encontrou diferenças.
- **Total Horas Extra:** consulta a elegibilidade em Lista Pessoas. Quando elegível, subtrai a coluna **D** de Colaboradores, que é a **hora de entrada normal**, e não a coluna de número de horas/dia. Como os 201 colaboradores têm atualmente entrada 08:00 e 8 horas/dia, o limiar coincide numericamente com oito horas, mas a referência é semanticamente inadequada para configuração futura. A demo conserva `horasExtraExcel` como evidência histórica, sem assumir esta fórmula como política definitiva.
- **Tempo Viagem Calc:** converte o texto de viagem em tempo, com `IFERROR(...,0)`. A formulação pode esconder entradas inválidas como zero. O campo textual original e o valor em cache são preservados separadamente.
- **Lista Pessoas:** deriva nomes distintos do ponto. Existem 35 pessoas com indicador de extra igual a 1 e 166 com indicador 0. Isso não prova empresa nem vínculo contratual.
- **Colaboradores:** ordena pares nome/preço da lista de pessoas. Os preços coincidem entre as duas folhas. A folha guarda suplementos de extra e noturno, mas não custos finais por dia/obra.
- **Lista Obras:** usa pares distintos obra/local. A apresentação textual contém seis repetições, compatíveis com tipos numéricos/textuais distintos na origem. As referências originais são mantidas por linha.

As perguntas que se podem preservar com dados reais são: horas por pessoa/obra/período, viagens, extra registado, despesas por obra/categoria/fornecedor e detalhe de cada lançamento. Não existe neste Excel um custo final de mão de obra aprovado nem uma margem de obra. Qualquer cálculo económico novo tem de indicar regras demonstrativas e continuar rastreável aos registos utilizados.

## Extração para a demo

Ficheiros em `data/source`:

- `obras.json`: todas as 240 referências de obra, local quando conhecido e proveniência. `selecionadaDemo` indica a seleção funcional, sem alterar os dados reais.
- `pessoas.json`: 201 pessoas, tarifas e parâmetros originais. `empresaId` e `tipo` ficam `null` porque não existem na fonte.
- `ponto.json`: **2 637 registos** associados às 12 obras selecionadas. Datas de 25/08/2025 a 22/08/2026.
- `faturas.json`: **1 111 registos** associados às mesmas obras. Datas de 01/10/2025 a 27/08/2026.
- `empresas.json`: nenhuma empresa identificada a partir do Excel. Pode ser complementado com proveniência explícita do levantamento; não se inferem empregadores a partir de fornecedores de faturas.
- `categorias.json` e `fornecedores.json`: tabelas auxiliares reais, preservando os rótulos originais.
- `excel-summary.json`: critérios de seleção, cobertura por obra, períodos e totais para reconciliação.
- `excel-structure.json`: estrutura de todas as folhas e exemplos das fórmulas inspecionadas.

Foram selecionadas as obras **26095, 26108, 26105, 26011, 26111, 26066, 26090, 26100, 26107, 26109, 25061 e 25094**. A seleção cobre obras com atividade recente, contextos diferentes e a relação histórica José Cardoso/25094 solicitada no briefing. Cada uma inclui **todos** os registos de ponto e faturas que lhe estão associados no ficheiro, sem corte parcial de datas. A obra 25094 possui ponto, mas nenhuma fatura no Excel; não foi criada uma fatura fictícia para preencher essa lacuna.

O subconjunto contém 102 pessoas com ponto, **22 235,25 horas** e **618 552,13 € em faturas**. Estes totais cobrem os dados presentes no ficheiro e as obras selecionadas, não uma reconciliação contabilística completa. Faturas com a mesma identificação não foram eliminadas automaticamente, pois podem corresponder a imputações repartidas.

Transformações aplicadas:

1. Datas em ISO e horas em `HH:mm`, mantendo datas originais.
2. Códigos de obra e números de fatura como texto; os números originalmente numéricos são também preservados em `numeroOriginalNumerico` nas faturas.
3. IDs técnicos determinísticos para pessoas e IDs por linha para factos.
4. Duração Excel convertida de fração de dia/tempo para horas decimais.
5. Horas noturnas derivadas por sobreposição dos intervalos registados com 22:00–07:00, janela existente na fonte. Este campo é duração, não uma regra de remuneração aprovada, e contém descrição do método.
6. Duas ocorrências `Rui cipriano` foram associadas a `Rui Cipriano` por correspondência sem distinção de maiúsculas. `nomeOriginal` e nota de origem preservam a diferença. Variantes com acentos distintos não foram fundidas.
7. Os identificadores internos de cartões foram omitidos por não serem necessários aos fluxos pedidos. Fornecedores, valores, códigos e categorias usados na demo são preservados.

Todos os registos reais têm `source: "ACRS"`, referência ao ficheiro, folha e linha. As relações ponto→pessoa, ponto→obra e fatura→obra foram verificadas, assim como o número integral de factos das obras selecionadas. Os scripts de leitura são `scripts/inspect-excel.py` e `scripts/extract-excel.py`.

## Limitações e qualidade da fonte

- `Ponto!B117` contém 01/01/1900. Não pertence às obras selecionadas e não foi silenciosamente corrigido.
- `Faturas!A2579` contém apenas espaços. Também está fora da seleção.
- Há 100 faturas sem obra, 20 sem categoria e uma sem número no conjunto global.
- Há 18 repetições adicionais de linhas idênticas nas seis primeiras colunas de faturas; é necessário validar se são duplicação ou imputação legítima antes de uma migração de produção.
- Há 16 valores de fatura com precisão superior a cêntimos. A precisão original foi preservada no JSON; a interface pode apresentar moeda arredondada a duas casas.
- Existem 590 grafias de fornecedor no histórico (546 após apenas retirar espaços externos e uniformizar maiúsculas) e 355 valores de categoria (350 com a mesma normalização). A tabela auxiliar tem apenas 188 entradas de fornecedor e 45 categorias. Isto revela entrada livre e taxonomia dispersa; a demo deve permitir chegar ao original sem inventar uma reconciliação final.
- Existem códigos como referências compostas, sufixos e prováveis lapsos numéricos. Não foram unidos a outras obras por aproximação.
- Os resultados das fórmulas são os valores em cache guardados pelo Excel. Foram lidos e confrontados com os intervalos horários; não foi executado o motor de cálculo Excel nem o Power BI.
- O histórico abrange 2025–2026; os dados não foram deslocados para setembro de 2026 para parecerem atuais. A data de referência e os períodos devem permanecer visíveis na demo.

## XML anexado

`data/teste-fornecedor.xml` é um catálogo de teste com raiz `catalogo` e cinco elementos `produto`. Tem campos `sku`, `nome`, `preco`, `stock`, `categoria` opcional e `imagem_url` opcional. Os exemplos são eletrónica e artigos de casa, com URLs de imagens placeholder. Não contém fornecedor fiscal, documento de compra, obra, inventário metalomecânico ou prova de relação com a ACRS.

O ficheiro foi analisado e **não foi importado como fatura, fornecedor ou stock real**. Pode servir no futuro para discutir o formato de importação de um catálogo, mas a primeira demo não precisa de uma integração externa. A estrutura e a exclusão estão documentadas em `excel-summary.json`.
