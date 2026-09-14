# ACRS — estado da demo após revisão funcional e do Power BI

> **Enquadramento atualizado em 14/09/2026:** este documento preserva a análise histórica da demo/fontes, não o estado de conclusão da Demo V1. Para o âmbito vigente, ler o [índice documental](README.md), o [Caderno](ACRS___Caderno_Encargos___DEMO.pdf) e a [análise funcional atualizada](analise-funcional.md). Persistência, quatro perfis reais, permissões no backend e OCR fazem agora parte da entrega V1. As regras ainda por confirmar nos novos PDFs continuam pendentes.

Data da revisão: 11 de setembro de 2026.

## Fontes consideradas

- Contexto Operacional e Blueprint Funcional fornecidos pela Vouga Agency;
- inventário real de agosto, com 485 linhas preservadas no catálogo;
- `ACRS_Data_Input.xlsm`, coerente com o modelo do Power BI;
- `ACRS Metal Solution_Dashboard.pbix`, inspecionado nas seis páginas, nove tabelas, relações e campos usados pelos visuais;
- pedido funcional da demo e correções posteriores do utilizador.

`teste-fornecedor.xml` foi excluído: o utilizador confirmou que não pertence à ACRS.

## O que foi atualizado

### Bobines

Cada bobine é agora uma unidade indivisível. Uma saída de 1 retira 1 bobine; uma referência com 25 bobines deixa 24. Quantidades fracionárias são recusadas e a sobra física não é devolvida ao stock. Isto aplica a regra de «Bobines e consumos especiais» do Contexto (página 9) e da secção 7 do Blueprint (página 21), corrigindo a interpretação anterior que retirava toda a referência.

### Faturas com revisão antes dos efeitos

Uma fatura nova fica `Por validar`. Enquanto estiver nesse estado não cria custo nem entrada de stock. João pode corrigir os dados, rejeitar sem efeito ou validar. Só a validação cria o efeito correspondente e regista utilizador/data. É o fluxo «documento → campos para validação → compra para stock ou despesa de obra» da página 18 do Blueprint e responde ao papel administrativo definido para João nas páginas 23–24.

### Materiais passam sempre pelo armazém

O formulário de despesa direta deixou de oferecer `Materiais`. Uma compra para stock exige artigo e quantidade e, depois de validada, gera entrada. O custo chega à obra quando o artigo sai do armazém. Artigos novos podem ser criados durante uma entrada, mantendo o mesmo circuito. Esta decisão aplica a correção posterior do utilizador, que prevalece sobre a exceção genérica de artigo extraordinário descrita no Blueprint.

### Períodos de controlo

O filtro de Controlo passou a aplicar início e fim tanto aos custos como às compras. `Agosto 2026` mostra apenas 1–31 de agosto; uma compra de setembro já não aparece. Mantém-se a seleção por obra/período usada no Power BI atual.

### Mão de obra

O motor suporta precedência de política global, empresa e pessoa. Funcionários ACRS recebem +50% a partir da 9.ª hora; trabalhadores das Empresas A–D recebem +50% a partir da 11.ª. Noturno vale +25%; sábado, domingo e feriado +50%; a viagem entra no custo da obra. A configuração permite exceções por pessoa e calendário de feriados. O controlo mostra horas trabalhadas, horas extra importadas, viagem e custo médio/hora, preservando as perguntas dos relatórios `Man Hour`, `Ponto` e `Despesa Colaborador` do PBIX.

### Orçamento e controlo económico

Foram criados orçamentos discriminados demonstrativos e duas vistas de `Previsto / Realizado / Comprometido / Desvio`: no detalhe da obra e em Controlo. Faturas por validar aparecem como comprometidas, sem contaminar o realizado. Mantêm-se também orçamento global, margem alvo, custo máximo, disponível e risco, conforme páginas 18–20 do Blueprint.

### Ferramentaria

A área de Controlo calcula, por equipamento, dias imputados, transferência interna, custo interno, manutenção, resultado operacional, custo de aquisição e percentagem recuperada. Os valores são deliberadamente marcados como demo, porque a página 29 do Blueprint exige validação de preços internos e custos diários.

### Consumo e reposição

Foi criada a rota `/armazem/consumo`, acessível no menu do armazém. Mostra os artigos mais consumidos em 30 dias, 3 meses ou 6 meses, consumo líquido, número de movimentos, média por 30 dias, stock, valor interno e dias estimados de cobertura. Responde diretamente à necessidade descrita na página 10 do Contexto e às «tendências de consumo e reposição» da página 20 do Blueprint. Como a ACRS não forneceu histórico de movimentos, a demo usa movimentos identificados como demonstrativos.

### Obras, perfis, tablet e unidades

- Obras podem ser criadas e editadas durante a sessão, com número, nome, cliente, local, responsável, estado e datas.
- João mantém a navegação administrativa completa; Vítor vê obras e recursos operacionais; Gerência recebe uma navegação de leitura focada em Dashboard, Obras e Controlo; Armazém e Campo entram nas interfaces simplificadas.
- Uma saída no tablet pode conter vários artigos antes da confirmação, evitando repetir obra e data.
- Quantidades apresentam unidade e precisão configuráveis. Bobines, unidades e caixas são inteiras; materiais medidos podem usar casas decimais. Os valores inferidos estão marcados como demo.

Estas alterações concretizam o mapa de perfis das páginas 23–25, o fluxo de tablet da página 17 e o requisito de unidade de medida da página 21 do Blueprint.

## O que falta por depender de input da ACRS

1. **Acumulação e calendário laboral:** os valores dos suplementos e os limites de hora extra já foram confirmados. Falta confirmar se os suplementos se acumulam quando coincidem e fornecer o calendário de feriados aplicável.
2. **Relação pessoa–empresa:** a demo distribui as pessoas entre ACRS e Empresas A–D, mantendo a maioria na ACRS. O ficheiro atual não identifica a empresa real de cada pessoa; esta distribuição terá de ser substituída antes da migração.
3. **Inventário validado:** confirmar código, variante, quantidade, localização, unidade e precisão de cada artigo. As unidades atuais são inferências de demo.
4. **Histórico de armazém:** entradas, saídas e devoluções reais com datas e obras. Sem ele, rankings de 3/6 meses, ritmo e cobertura são apenas cenários.
5. **Stock mínimo e política de compra:** mínimos, lead time, lote mínimo, fornecedor preferencial e regra para aproveitar descontos por volume.
6. **Preços internos da ferramentaria:** valor de transferência por artigo/família, custo interno diário, aquisição, manutenção e amortização de máquinas.
7. **Orçamentos reais:** valores comerciais, margens alvo e rubricas previstas por obra. Os atuais são demonstrativos.
8. **Clientes, responsáveis e estado das obras:** estes campos não estão completos nas fontes; parte da informação apresentada foi criada para navegação.
9. **Regras de validação de faturas:** quem pode validar, motivos de rejeição, tratamento de duplicados, impostos, notas de crédito e aprovação por montante.
10. **Artigos especiais:** decidir o circuito operacional de serviços, reparações e material que segue diretamente do fornecedor para a obra, mantendo a entrada virtual em armazém.
11. **Viaturas e contentores:** confirmar a metodologia de custo de viaturas e se os contentores serão localizações de stock.
12. **Integração e produção:** base de dados, autenticação, permissões ao nível da ação, documentos persistentes, OCR, auditoria e migração histórica pertencem à fase seguinte e precisam de decisões técnicas e operacionais.

## Validação executada

- TypeScript sem erros;
- build estático de produção concluído em 31 páginas;
- 14 testes do motor aprovados, incluindo bobines, stock negativo, devolução, fatura pendente/validada, compras, reservas futuras, máquinas, horas extra e orçamento;
- revisão no browser de Dashboard, Obras/Nova obra, Faturas, Consumo e reposição, filtro de Compras em agosto e perfil do Vítor.
