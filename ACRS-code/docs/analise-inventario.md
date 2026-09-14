# Análise integral do inventário ACRS

> **Enquadramento atualizado em 14/09/2026:** este documento preserva a análise histórica da demo/fontes, não o estado de conclusão da Demo V1. Para o âmbito vigente, ler o [índice documental](README.md), o [Caderno](ACRS___Caderno_Encargos___DEMO.pdf) e a [análise funcional atualizada](analise-funcional.md). Persistência, quatro perfis reais, permissões no backend e OCR fazem agora parte da entrega V1. As regras ainda por confirmar nos novos PDFs continuam pendentes.

Fonte: `data/STOCK ARMAZEM MÊS AGOSTO.pdf`, 9 páginas. O documento diz «MÊS DE REFERÊNCIA - AGOSTO» e não identifica o ano no corpo. É uma fotografia do inventário fornecido, não uma confirmação do stock atual em setembro de 2026.

## Extração e rastreabilidade

Extraídas todas as **485 linhas de artigos**, sem amostragem, exclusão, deduplicação ou correção de catálogo, para `data/source/inventory.json`. As primeiras oito páginas contêm 57 artigos cada; a última contém 29. O script reproduzível é `scripts/extract_inventory.py`, usando `pdfplumber` sobre texto e tabelas nativos do PDF. As páginas 7 e 9 foram também renderizadas e inspecionadas visualmente para confirmar estrutura, variantes, bobines, unidades e total.

Cada registo contém `id`, `codigoACRS`, `familia`, `material`, `tamanho`, `descricao`, `marca`, `quantidade`, `precoUnitario`, `precoTotal`, `localizacao`, `source: "ACRS"`, `sourcePage` e `sourceRow`.

- O ID interno usa a posição da fonte: `inv-p07-r023`. É único e determinístico para este ficheiro; o código ACRS nunca serve de chave única.
- `sourcePage` começa em 1; `sourceRow` começa em 1 e inclui o cabeçalho. O primeiro artigo de cada página está na linha 2.
- Texto e grafia mantêm-se; remove-se apenas espaço exterior. Células em branco são `null`.
- Quantidades e preços são convertidos de vírgula decimal para números JSON, com validação em `Decimal` antes de escrever os ficheiros.
- `tamanho` mantém-se texto: `M10`, `1.0`, `6`, `6.0`, `1,200 MT`, `400ML`, `PACK` etc. não são normalizados.
- Não foram acrescentados mínimos, preços internos, margens de saída, unidades inferidas ou políticas operacionais ao ficheiro real.

## Reconciliação

| Verificação | Resultado |
|---|---:|
| Linhas de artigos | 485 |
| IDs internos distintos | 485 |
| Códigos ACRS distintos | 442 |
| Códigos com mais de uma ocorrência | 18 |
| Famílias distintas, preservando grafia | 22 |
| Linhas com quantidade zero | 14 |
| Linhas com quantidade fracionária | 20 |
| Total impresso no PDF | 46.325,87 € |
| Soma dos totais das 485 linhas | 46.325,87 € |
| Diferença de reconciliação | 0,00 € |
| Linhas com quantidade × preço diferente do total | 0 |
| Linhas completamente idênticas | 0 |

Todas as localizações contêm **ARMAZÉM**, sem indicação de prateleira ou zona. Faltam material em 20 linhas, tamanho em 8 e marca em 465. Só 20 linhas têm marca explicitamente preenchida: BERNER, EURO TRODO, MAC FER, VITO, VULCAN e WURTH.

Não somar as quantidades e apresentar o resultado como «unidades em stock»: há peças, metros e quantidades em massa no mesmo documento. Os perfis IPE/HEB têm quantidades e preços coerentes com kg indicados na descrição; outros tubos usam comprimentos em metros. A fonte não fornece uma coluna de unidade explícita. O valor monetário total é agregável; a quantidade física global não é.

O detalhe verificável das contagens, lacunas, duplicados e reconciliação está em `data/source/inventory-audit.json`.

## Famílias reais

| Família | Artigos |
|---|---:|
| PARAFUSO | 220 |
| ANILHA | 52 |
| PORCA | 48 |
| TUBO | 33 |
| FARDA | 27 |
| DISCO | 20 |
| EPI | 19 |
| SPTIS | 16 |
| SOLDA | 10 |
| SPITS | 7 |
| SPRAY | 7 |
| CERRA CABOS | 6 |
| ESTICADOR | 6 |
| BUCHA | 3 |
| GAS | 3 |
| PINTURA | 2 |
| ARNES | 1 |
| GRAMPO | 1 |
| HOLOFOT | 1 |
| OLHAL | 1 |
| PERNO | 1 |
| VEDANTE | 1 |

`SPITS` e `SPTIS` aparecem como famílias diferentes na fonte e foram preservadas. Uma eventual equivalência de pesquisa pode existir na demo como regra separada, sem alterar o catálogo real.

## Anomalias e variantes preservadas

Há variantes legítimas e divergências a reconciliar com a ACRS. Não se pode concluir que todo o código repetido é um erro.

- `DC125FR1.0`: WURTH, MAC FER e BERNER, com quantidades e preços distintos. O mesmo ocorre em outros discos.
- `LUVA CHEFE`, `LUVA NITRILICO`, botas, fardas e calças: códigos repetidos por tamanho. `GARRAFA GAS` repete-se por tipo de gás.
- `AM10ALZN`: duas linhas com a mesma descrição, material e tamanho, mas quantidades 187 e 15 (página 5, linhas 25 e 27). Foram conservadas separadamente.
- `PM6CRZN`: mesma descrição e material, quantidades 29 e 32 (página 4, linha 57; página 5, linha 50). Foram conservadas separadamente.
- `AM20ALZN`: tamanhos M20 e M21; descrições «ABA LARGA +» e «ABA LARGA» (página 5, linhas 39 e 40).
- `PM12FRA2`: uma linha INOX (página 2, linha 48) e outra ZINCADO (página 6, linha 3), apesar do código igual.
- Há potenciais divergências entre código e tamanho: `M6ST50A2RT`/M7, `M16ST75A2RT`/M17, `M5OW15A2RT`/M50, `M6OW25A2RT`/M60, `M8OW16A2RT`/M80, `M6AP90ZNRP`/M7 e `M8ST40GPRT`/M10. Os valores continuam exatamente como na fonte.
- `DR230FR9.0` tem tamanho `6.5`; `DC180A21.6` tem material FERRO. São diferenças a validar, não erros corrigidos automaticamente.
- «SPRAY ZINCO BRILHANTE BERNER», «SPRAY OLEO DE CORTE BERNER» e «HOLOFOT MILWAUKEE M18» incluem marcas na descrição, mas têm a coluna marca vazia. A extração não preenche essa coluna por inferência.
- `B140X140X10QD`, `HOLOFOT`, `ARGOM`, `POLIBUTANO` e variantes de grafia como UMBRACO/UMBRAKO mantêm-se.

## Aplicação à demo

O mesmo dataset deve alimentar stock, pesquisa, famílias, marcas, seletores e tablet. O seletor de variantes deve mostrar pelo menos código, tamanho e marca para distinguir linhas parecidas. As linhas sem marca podem mostrar «—»; a localização é ARMAZÉM, sem prateleiras inventadas.

Exemplos úteis para os fluxos:

| ID interno | Artigo real | Quantidade | Preço unitário |
|---|---|---:|---:|
| inv-p07-r023 | DC125FR1.0 / DISCO DE CORTE / BERNER | 500 | 0,75 € |
| inv-p07-r030 | DL125A2 / DISCO LAMELA / VITO | 50 | 1,15 € |
| inv-p08-r020 | LUVA CHEFE / tamanho 9 | 200 | 2,40 € |
| inv-p07-r041 | AWSFR / BOBINE SOLDA / FERRO | 25 | 40,50 € |
| inv-p07-r042 | ASWA2 / BOBINE SOLDA / INOX | 23 | 58,50 € |
| inv-p09-r015 | EL7018-2,5 / ELETRODO / EURO TRODO | 12 | 23,75 € |

Bobines aparecem como quantidades agregadas de um artigo, sem número individual. A regra demonstrativa `TOTAL_NA_SAIDA`, pedida no prompt funcional, deve ficar em dados demo separados. O inventário não contém rastreabilidade de bobines individuais nem histórico físico das suas reutilizações; a regra vem do pedido e do contexto operacional, não das colunas deste PDF.

Mínimos, valorização interna, movimentos, fornecedor de entrada, datas de saída, atribuição à obra e ranking de consumo não estão neste PDF. Para a demonstração, devem existir em `data/demo`, marcados `source: "demo"`, ligados aos IDs reais. O stock inicial e o valor original continuam rastreáveis ao inventário; a sessão pode depois aplicar entradas, saídas e devoluções em estado local.
