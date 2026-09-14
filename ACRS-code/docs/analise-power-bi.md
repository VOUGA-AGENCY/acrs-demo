# Análise do Power BI atual da ACRS

> **Enquadramento atualizado em 14/09/2026:** este documento preserva a análise histórica da demo/fontes, não o estado de conclusão da Demo V1. Para o âmbito vigente, ler o [índice documental](README.md), o [Caderno](ACRS___Caderno_Encargos___DEMO.pdf) e a [análise funcional atualizada](analise-funcional.md). Persistência, quatro perfis reais, permissões no backend e OCR fazem agora parte da entrega V1. As regras ainda por confirmar nos novos PDFs continuam pendentes.

Fonte analisada: `ACRS Metal Solution_Dashboard.pbix`, localizado em `/Users/miguel/Desktop/vouga agency/projects/ACRS/`. O ficheiro foi inspecionado diretamente, sem o executar como fonte de dados e sem alterar o original.

## Estrutura do modelo

O PBIX contém 6 páginas, 9 tabelas, 91 colunas, 26 medidas, 10 relações ativas e cerca de 27,5 mil linhas no modelo. As tabelas funcionais são:

- `Dados_Ponto`: cerca de 8,9 mil linhas e 18 colunas;
- `Dados_Trabalho_Obra`: cerca de 8,9 mil linhas e 24 colunas calculadas;
- `Dados_Faturas`: cerca de 4,2 mil linhas e 7 colunas;
- `Master_Colaboradores`: 201 pessoas e 6 colunas;
- `Master_Obras`: 177 obras/combinações e 3 colunas;
- `Master_Cal`: calendário com cerca de 2,2 mil linhas e 12 colunas;
- três tabelas automáticas de datas.

As dez relações são todas ativas, muitos-para-um e unidirecionais. Ponto e Trabalho ligam a Colaboradores por nome, a Obras por código e ao calendário por data. Faturas ligam a Obras pelo número e ao calendário pela data. O modelo depende, portanto, de texto/nome como chave em algumas dimensões; o produto futuro deve usar IDs internos estáveis.

## Páginas e perguntas de gestão

1. **Posição integrada** — visão global por obra, mês, ano e colaborador. Inclui valor total da obra, valor de despesa/salário, horas, horas extra, extra noturno, viagem, salários versus horas e despesas por obra.
2. **Relatorio Man Hour** — custo médio/hora, total de horas, horas extra, peso de viagens, rácios de extra e evolução mensal.
3. **Relatorio Ponto** — horas por ano/semana, obras trabalhadas, entradas/saídas e evolução de horas normais e extra.
4. **Relatorio de Obra** — custo total da obra, evolução dos gastos, despesa por cartão, custo por colaborador, total de despesas e mapa/localização.
5. **Detalhe Despesa Obra** — detalhe por data, fornecedor, categoria, obra e valor.
6. **Relatorio Despesa Colaborador** — horas e viagem por colaborador, obra e período.

Entre os campos e medidas efetivamente usados nos visuais encontram-se `Valor_Total_Dia_Medida`, `Total_Horas_Medida`, `Valor Total Obra`, `Custo_Medio_Real_Hora`, `Total_Horas_Extras`, `V_H_Ext_Noturnas`, `T_viagem_Calc`, categoria da despesa, fornecedor/cartão, obra, colaborador, mês e ano.

## O que deve ser preservado

- Seleção por obra, colaborador e período;
- custo total e evolução por obra;
- custos e horas de colaboradores;
- horas extra, noturno e peso da viagem;
- custo médio por hora;
- despesas por fornecedor, categoria e cartão;
- detalhe do lançamento por data;
- passagem da visão agregada para o detalhe.

A demo distribui estas perguntas pelos contextos de Obra, Pessoa, Fatura e Controlo. Não reproduz a composição visual do Power BI.

## O que o PBIX não contém

Não foram encontradas entidades ou páginas operacionais para stock, movimentos de armazém, consumos, máquinas, alocações, orçamento, margem alvo ou custo máximo. O PBIX confirma que o sistema atual explica atividade e custo realizado; não regista toda a operação que origina esses custos.

Consequentemente, consumo e reposição de artigos só podem usar movimentos demonstrativos nesta demo. Um histórico real começa quando as entradas, saídas e devoluções passarem a ser registadas no novo sistema.

## Limitações da inspeção

A estrutura, tabelas, relações, páginas, visuais e campos utilizados foram inspecionados. O texto integral das 26 expressões DAX não foi exportado pela ferramenta disponível. As fórmulas do Excel e os campos usados nos visuais permitem confirmar as perguntas de gestão, mas não justificam copiar automaticamente a implementação dos cálculos para produção.
