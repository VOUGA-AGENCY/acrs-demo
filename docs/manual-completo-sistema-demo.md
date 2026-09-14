# ACRS — documentação completa da demo operacional

> **Enquadramento atualizado em 14/09/2026:** este documento preserva a análise histórica da demo/fontes, não o estado de conclusão da Demo V1. Para o âmbito vigente, ler o [índice documental](README.md), o [Caderno](ACRS___Caderno_Encargos___DEMO.pdf) e a [análise funcional atualizada](analise-funcional.md). Persistência, quatro perfis reais, permissões no backend e OCR fazem agora parte da entrega V1. As regras ainda por confirmar nos novos PDFs continuam pendentes.

**Preparado para:** Miguel Correia · Vouga Agency  
**Destinatários adicionais:** Vasco e Patrick, para continuidade do desenvolvimento  
**Data da revisão:** 13 de setembro de 2026  
**Âmbito:** estado efetivo do código da demo, após as alterações ao armazém e ao tablet.

## Como ler este documento

Este documento descreve páginas, componentes, operações, cálculos, dados partilhados e decisões de produto. Foi elaborado por inspeção do código atual, das estruturas de dados e dos documentos de análise existentes. Não é apenas uma transcrição dos pedidos ou das respostas anteriores.

Distinguem-se três situações:

- **Disponível:** existe e é acessível na navegação atual, com efeitos durante a sessão quando aplicável.
- **Demonstrativo:** funciona com dados ou parâmetros fictícios, inferidos ou configurados para apresentação.
- **Parcial / sem acesso integrado:** existe código ou parte do comportamento, mas o percurso atual não permite usar a funcionalidade completa.

Uma funcionalidade programada mas sem acesso na interface não é considerada operacionalmente concluída. Os problemas identificados são discriminados na secção 18. Esta revisão produz documentação; não corrige o código.

O código é a referência para o que existe. O Contexto Operacional, o Blueprint e os pedidos de Miguel explicam a intenção. As instruções posteriores de Miguel prevalecem sobre opções anteriores, nomeadamente na unificação do armazém, clientes demo, ausência de responsável por obra e fluxo do tablet.

## 1. Objetivo e natureza do sistema

A demo materializa uma plataforma operacional para a ACRS Metal Solutions. A obra é o centro económico: reúne pessoas, horas, deslocações, faturas, consumíveis, utilização de equipamentos e valor orçamentado.

O objetivo é mostrar como registar uma operação e observar o seu efeito nos outros módulos. Exemplo: uma saída no tablet altera a disponibilidade de um artigo, aparece no histórico e acrescenta custo à obra e às análises de Controlo.

A solução aproveita as perguntas que a ACRS já faz em Excel e Power BI, acrescentando os circuitos operacionais que esses instrumentos não cobriam de forma integrada.

### 1.1 O que significa «demo frontend»

- Aplicação Next.js / React / TypeScript, com exportação estática.
- Sem servidor de negócio, base de dados, autenticação ou armazenamento documental persistente.
- Os dados iniciais são carregados de ficheiros locais e enriquecidos com cenários demonstrativos.
- As alterações vivem no estado React partilhado enquanto se navega na mesma sessão da aplicação.
- Recarregar a página repõe o cenário inicial; outras abas/dispositivos não recebem as alterações.
- O perfil selecionado também é uma simulação local.
- Não existe sincronização com o Excel ou Power BI em tempo real.

**Porquê:** nesta fase pretende-se validar funcionamento, linguagem e percursos antes de investir na infraestrutura do produto final.

## 2. Fontes, proveniência e cenário inicial

### 2.1 Fontes de referência

| Fonte | Utilização no projeto | Limite |
|---|---|---|
| Contexto Operacional ACRS | Entendimento dos processos, problemas e exceções | Descreve o negócio; não é uma base de dados |
| Blueprint Funcional | Arquitetura funcional, módulos, fluxos e perfis | Algumas opções foram refinadas por Miguel |
| Prompt funcional inicial e pedidos posteriores | Estrutura da demo e critérios de comportamento | A implementação atual tem limitações listadas adiante |
| Inventário de agosto em PDF | Catálogo de 485 linhas com códigos, variantes, preços e quantidades | Unidades, mínimos e vários valores internos são inferidos |
| JSONs em `data/source/` | Obras, pessoas, ponto, faturas e inventário usados pela aplicação | São carregamentos locais, não integrações |
| PBIX da ACRS | Referência das perguntas de gestão e das relações analíticas | As expressões DAX completas não foram exportadas |
| `data/demo/scenario.ts` | Empresas, políticas, equipamentos, alocações e movimentos fictícios | Não representa cadastro ou histórico real |

**Nota sobre o Excel de teste:** Miguel indicou que o Excel de teste não era da ACRS. Apesar disso, o código atual continua a importar `obras.json`, `pessoas.json`, `ponto.json` e `faturas.json` produzidos pelo processo de extração existente. Os documentos anteriores tratam esse material como coerente com o PBIX e dizem ter excluído `teste-fornecedor.xml`. Isso não resolve, por si só, a dúvida sobre a proveniência do Excel. É necessário confirmar a origem desses JSONs antes de lhes atribuir estatuto de dados reais na entrega. Esta documentação não certifica essa origem.

### 2.2 Dimensão da demo, verificada no estado inicial

| Entidade | Quantidade | Observação |
|---|---:|---|
| Obras | 12 | 11 em curso e 1 concluída |
| Artigos de inventário | 485 | Linhas/variantes preservadas |
| Máquinas, equipamentos e caixas | 24 | Cadastro demonstrativo |
| Recursos na lista unificada | 509 | 485 artigos + 24 ativos |
| Alocações | 22 | 21 abertas e 1 terminada |
| Ativos disponíveis para nova alocação | 1 | Os restantes estão em obra, reparação ou indisponíveis |
| Pessoas | 201 | 121 atribuídas à ACRS e 20 a cada Empresa A–D |
| Empresas | 5 | ACRS Metal Solutions, Empresa A, B, C e D |
| Registos de ponto | 2 637 | Datas entre 25/08/2025 e 22/08/2026 |
| Faturas | 1 111 | 28 começam «Por validar» |
| Movimentos de stock | 33 | 3 movimentos explícitos + 30 saídas demo para consumo histórico |
| Orçamentos | 12 | 3 discriminados e 9 simples |
| Custos manuais iniciais | 0 | A estrutura existe |

Os estados de validação das faturas são atribuídos artificialmente na inicialização. Não são estados de aprovação importados do sistema da ACRS.

### 2.3 Obras e valores comerciais demonstrativos

| Obra | Valor orçamentado | Modo |
|---|---:|---|
| 25094 | 7 400 € | Discriminado |
| 26095 | 82 700 € | Discriminado |
| 26108 | 27 400 € | Discriminado |
| 26105 | 15 400 € | Simples |
| 26011 | 131 100 € | Simples |
| 26111 | 10 800 € | Simples |
| 26066 | 95 000 € | Simples |
| 26090 | 23 600 € | Simples |
| 26100 | 11 100 € | Simples |
| 26107 | 5 400 € | Simples |
| 26109 | 4 500 € | Simples |
| 25061 | 866 900 € | Simples |

Clientes: `Cliente 1 · demo` a `Cliente 4 · demo`, distribuídos pelas obras. Não existe entidade autónoma de clientes nem dados fiscais/contactos. O campo responsável foi removido do modelo e das interfaces a pedido de Miguel.

Os valores comerciais são gerados a partir dos custos em 11/09/2026 e de rácios de consumo pretendidos para o cenário, com margem alvo de 20%. Assim existem exemplos saudáveis, de atenção e de risco. São valores de apresentação, não propostas comerciais reais.

## 3. Navegação, identidade visual e perfis

### 3.1 Estrutura do menu

```text
Dashboard
Obras
Armazém [clicável]
  Recursos
  Movimentos
  Consumo e reposição
  Tablet
Faturas & Compras
Pessoas [título de grupo]
  Ponto
  Colaboradores
  Empresas
Orçamentos
Controlo
Configuração
```

«Visão geral» deixou de ser uma opção adicional na sidebar. A página principal do armazém ainda tem esse título no conteúdo. «Máquinas» deixou de ser um destino principal, passando a filtro dentro de Recursos; permanece como separador técnico de Configuração.

### 3.2 Estilo e componentes comuns

- Logótipo ACRS centrado no topo da sidebar, com ligação à raiz `/`.
- Rodapé da sidebar com «Developed by» e logótipo pequeno da Vouga Agency.
- Fundos pastel por categoria: operação, armazém, pessoas e gestão/administração.
- Cor laranja para seleção ativa e ações principais.
- Cabeçalho com percurso de navegação e seletor de perfil.
- Tabelas com paginação de 12 registos por defeito, estados vazios e scroll horizontal.
- Cartões de indicadores, badges de estado, filtros, campos de pesquisa, modais e painéis laterais reutilizados.
- Formatação monetária em euros e convenções portuguesas; unidades visíveis nas quantidades.
- Notificações temporárias após operações.
- Sidebar reduzida a ícones em larguras pequenas; tablet e Campo usam uma estrutura simplificada.

**Porquê:** manter uma linguagem familiar e industrial, simples de ler, com poucas convenções e sem uma estética de produto de IA.

### 3.3 Perfis efetivos

| Perfil | Experiência atual | Motivo |
|---|---|---|
| João Catalão | Dashboard económico e navegação administrativa completa | Controlo de custos, documentos, ponto e margem |
| Vítor | Dashboard operacional; Obras e Armazém visíveis no menu | Operação, disponibilidade e recursos |
| Armazém | Encaminhamento automático para o tablet | Registo rápido no local da operação |
| Gerência | Menu com Dashboard, Obras e Controlo; criação/edição de obra escondida | Leitura de indicadores e exceções |
| Campo | Encaminhamento para envio simplificado de despesa | Captura de documento ligado à obra |

**Limite:** estes perfis ajustam interface e encaminhamento, mas não são permissões de segurança. Esconder uma ligação não impede, em geral, acesso direto a outras rotas. Também não há login real ou auditoria autenticada. O logótipo aponta para o dashboard, mas Armazém e Campo são novamente encaminhados para as respetivas áreas pelo código do perfil.

## 4. Mapa de páginas e ligações

| URL | Página / resultado | Ligações principais |
|---|---|---|
| `/` | Dashboard conforme perfil | Obras, Controlo, Orçamentos, Faturas, Ponto, Armazém |
| `/obras` | Lista de obras | Detalhe, criação por modal |
| `/obras/{id}` | Detalhe da obra | Custos, pessoas, materiais, equipamentos, faturas, orçamento, tablet |
| `/armazem` | Página principal do armazém | Recursos, movimentos, consumo e tablet |
| `/armazem/recursos` | Catálogo unificado | Filtros de tipo, reposição e registo pelo tablet |
| `/armazem/stock` | Compatibilidade com endereço antigo | Recursos com filtro Consumíveis |
| `/armazem/maquinas` | Compatibilidade com endereço antigo | Recursos com filtro Máquinas |
| `/armazem/movimentos` | Histórico de movimentos de artigos | Detalhe do movimento e tablet |
| `/armazem/consumo` | Controlo iniciado no separador Consumo de stock | Consumo líquido, cobertura e detalhe |
| `/armazem/tablet` | Interface de registo e consulta | Lista mista de saída e consulta de Recursos |
| `/faturas` | Faturas & Compras | Adicionar, corrigir, rejeitar, validar e consultar |
| `/pessoas/ponto` | Mapa semanal | Editor de pessoa/dia e novo ponto |
| `/pessoas/colaboradores` | Lista de pessoas | Ficha com resumo, ponto, obras e custos |
| `/pessoas/empresas` | Empresas internas/subcontratadas | Trabalhadores, obras e custos por empresa |
| `/orcamentos` | Orçamentos comerciais e rubricas | Formulário simples/discriminado |
| `/controlo` | Análises agregadas | Oito separadores e detalhe de custos |
| `/configuracao` | Parâmetros e regras | Artigos, famílias, tarifas, empresas, regras, perfis |
| `/campo` | Envio de despesa | Documento, obra, campos e submissão por validar |

Existem 33 páginas pré-geradas na exportação atual, incluindo os detalhes de obras e uma rota para nova obra demo. Não são 33 módulos diferentes.

## 5. Dashboard

### 5.1 João Catalão

Quatro indicadores iniciais:

1. Valor total orçamentado das obras ativas: soma do valor comercial das obras «Em curso».
2. Custo máximo agregado: soma dos limites derivados da margem alvo dessas obras.
3. Custo atual: soma dos custos dessas obras.
4. Obras em risco: número de obras ativas que atingiram o limite de custo.

Abaixo existem apenas as ações «Registar ponto» e «Adicionar fatura», esta última a laranja. Foram removidas as ações duplicadas do cabeçalho e a faixa redundante de pendências.

«Adicionar fatura» navega para a página de faturas; não abre diretamente o formulário. O mesmo princípio aplica-se ao botão de ponto.

Secções adicionais:

- **Obras que requerem atenção:** seleciona obras ativas a partir de 70% do custo máximo, ordenadas pelo consumo. Apresenta valor da obra, margem alvo, custo máximo, custo atual e motivo do alerta.
- **Motivo do alerta:** excesso monetário sobre o limite, margem abaixo da meta ou percentagem do custo máximo utilizada.
- **Atividade recente:** mistura movimentos de artigos, alocações e faturas demo, ordenados por data; mostra os quatro mais recentes.
- **Armazém e recursos:** valor de stock de artigos, recursos em obra e artigos abaixo do mínimo; permite entrar em Recursos e abrir o tablet.

**Porquê:** responder imediatamente «quanto tenho contratado, quanto posso gastar, quanto gastei e onde preciso de agir».

### 5.2 Vítor

Indicadores de obras em curso, pessoas com registos, recursos em obra, disponíveis, em reparação e artigos abaixo do mínimo. Mostra lista de obras em curso com pessoas/equipamentos e ação de registar movimento. O foco é disponibilidade e execução.

### 5.3 Gerência

Indicadores agregados de obras ativas, valor orçamentado, custo e margem. Apresenta obras com atenção e distribuição de custos em vez da atividade recente administrativa. A leitura usa o histórico agregado, com diferenças de âmbito face aos indicadores de obras ativas do João.

## 6. Obras

### 6.1 Lista

- Pesquisa por número, nome ou local.
- Filtros de estado, cliente e risco.
- Resumo de obras em curso e obras em risco.
- Colunas de número/nome, cliente, local, valor orçamentado, custo atual, custo máximo, consumo, margem e estado/risco.
- Clique numa linha abre o detalhe.
- «Nova obra» abre formulário; Gerência não vê esse botão.

### 6.2 Criação e edição

Campos: número, nome, cliente, local, estado, data de início e data de fim. Estados: Em preparação, Em curso, Suspensa e Concluída. Não existe responsável associado.

Valida número e nome e impede número repetido na criação. Guarda no estado partilhado. O orçamento é gerido separadamente.

**Limite importante:** todas as novas obras usam atualmente o ID fixo `demo-nova-obra`. Criar uma segunda nova obra na sessão substitui a primeira com esse ID. Não existe cadastro de várias novas obras preparado para produção.

### 6.3 Detalhe

Topo: nome, local, cliente, estado; ações de edição e tablet quando disponíveis para o perfil. Indicadores: valor orçamentado, margem alvo, custo máximo, custo atual, saldo disponível e margem atual.

| Separador | Conteúdo e relações |
|---|---|
| Resumo | Distribuição de custos, acompanhamento de execução e últimos lançamentos |
| Custos | Pesquisa, categoria, tabela de lançamentos e painel da origem |
| Pessoas | Pessoas com ponto na obra; empresa, horas normais, extra, noturno, viagem e custo; ligação à ficha da pessoa |
| Materiais | Saídas/devoluções de artigos, referência, família, quantidade, valor interno, total e data |
| Equipamentos | Alocações, saída, devolução, dias, tarifa diária, custo e estado |
| Faturas | Documentos associados, fornecedor, número, categoria, valor e estado; consulta documental |
| Valor orçamentado | Valor comercial, margem alvo, limite e, nos discriminados, previsto/realizado/comprometido/disponível por rubrica |

**Porquê:** a pessoa pode consultar uma obra inteira sem montar manualmente vários ficheiros. As categorias mantêm-se distintas para controlo económico, mesmo com o armazém operacional unificado.

## 7. Armazém

### 7.1 Página principal

Indicadores de total de recursos, valor dos artigos em stock, alocações abertas e alertas de reposição. Cartões levam à consulta, histórico e tablet. Há uma área de artigos a repor e equipamentos em reparação.

O valor de stock corresponde aos 485 artigos valorizados pelo valor interno; não soma o custo de aquisição dos 24 ativos. O número «recursos em obra» conta alocações abertas de ativos, não todas as unidades de consumíveis retiradas.

### 7.2 Recursos — catálogo unificado

Filtros: Todos, Consumíveis, Ferramentas, Máquinas e Equipamentos. Pesquisa de referência, nome, marca e família. Botão para mostrar apenas artigos abaixo do mínimo. Suporta parâmetros `tipo` e `alerta=baixo` nos links.

Colunas:

- Referência e nome, com marca/família/modelo.
- Tipo de recurso.
- Estado operacional.
- Alerta de inventário separado.
- Localização ou obra.
- Regra de custo.
- Quantidade disponível para artigos ou tarifa diária para ativos.

**Porquê:** há um único armazém na experiência operacional. A diferença está na regra de cada recurso, não em obrigar o utilizador a navegar entre dois sistemas.

**Implementação efetiva:** a lista combina `articles` e `machines`; não existe ainda uma entidade única de recurso no armazenamento. Todos os artigos do inventário entram em Consumíveis. Caixas de ferramentas são Ferramentas; nomes com gerador/compressor são Equipamentos; os restantes ativos são Máquinas. Esta classificação por nome é uma aproximação demonstrativa.

**Parcial:** as linhas atuais não abrem uma ficha. As fichas adaptativas anteriores existem noutros componentes, mas não foram ligadas ao catálogo unificado. Também não há filtro operacional completo por «Em obra», «Reservado» ou «Em manutenção».

### 7.3 Movimentos

Mostra entradas, saídas, devoluções e tipo manual legado «Outro», com pesquisa, filtro, data efetiva, artigo, obra, quantidade, valor, utilizador e estado programado/registado.

O painel de detalhe inclui data do registo, ID, valor unitário e saída original. Distingue a data em que aconteceu da data em que se introduziu a informação.

**Limite:** esta lista só lê `movements`. As alocações de máquinas vivem em `allocations` e ainda não aparecem aqui. A unificação do histórico é trabalho pendente.

### 7.4 Consumo e reposição

- Períodos próprios: 30 dias, 3 meses e 6 meses, implementados como 30/90/180 dias.
- Consumo líquido = saídas − devoluções efetivas no período.
- Número de saídas, média por 30 dias, valor interno consumido e stock disponível.
- Cobertura estimada = stock disponível / consumo médio diário.
- Cinco prioridades de cobertura inferior a 15 dias: Crítico a zero, Baixo abaixo de 7 dias, Atenção abaixo de 15 dias.
- Clique no artigo da tabela conduz aos custos dos movimentos correspondentes.

**Porquê:** ajudar a perceber quais os artigos que saem mais e sustentar decisões de reposição/compra por volume.

**Limites:** histórico fictício, sem prazos de entrega, encomendas, descontos ou proposta automática de compra. A ordenação por quantidade compara artigos com unidades diferentes; não deve ser interpretada como comparação direta de procura entre metros e unidades. A rota reutiliza toda a página Controlo, incluindo indicadores e outros separadores; ainda não é uma página independente dedicada ao armazém.

## 8. Tablet — saída com lista mista

### 8.1 Início e tamanho dos elementos

Duas entradas principais centradas e empilhadas: Registar movimento e Consultar recursos. Mesma largura e altura base de 148 px. Seleção de obra em cartões largos, texto de cliente separado e áreas de toque amplas. Famílias e artigos são cartões. Ações finais têm larguras equilibradas.

Existem regras responsivas que mudam alguns tamanhos em ecrãs pequenos; os valores base não se aplicam de forma universal a todas as larguras. Nem todas as ações do fluxo atual herdam os estilos do antigo `wizard-panel`.

### 8.2 Percurso de saída

```text
Registar movimento
  → Obra em curso
  → Consumível/material OU maquinaria/equipamento
  → Família
  → Artigo ou ativo individual
  → Quantidade
       → ADICIONAR OUTRO ARTIGO → volta ao tipo de recurso
       → TERMINAR LISTA → Data efetiva → Lista completa → Confirmar saída
```

- A obra mantém-se enquanto se constrói a lista.
- Ao voltar ao tipo, aparece um resumo dos recursos já adicionados.
- Consumíveis aceitam quantidade com a precisão configurada e verificam o saldo disponível.
- As quantidades já colocadas na lista são descontadas da disponibilidade usada na validação da quantidade seguinte.
- Máquinas/equipamentos identificados individualmente têm quantidade 1.
- Só ativos disponíveis e sem alocação aberta são selecionáveis.
- Um ativo já adicionado não volta a aparecer entre as opções.
- Maquinaria tem famílias demonstrativas: Soldadura; Corte e furação; Energia e apoio; Ferramentas retornáveis.
- A lista final permite remover linhas.
- A data é comum a todos os recursos.

### 8.3 Efeitos da confirmação

Cada consumível gera uma saída em `movements`. Cada ativo gera uma alocação em `allocations`, com tarifa diária copiada e devolução em aberto. O estado global só é substituído após todas as linhas passarem nas funções de validação: se uma linha falhar, a lista não é parcialmente aplicada ao estado visível.

O resumo financeiro agrega valor dos consumíveis e uma diária de cada ativo. Não é uma estimativa de utilização futura; ativos continuam a acumular diárias até à devolução. O custo só entra no livro de custos a partir da data efetiva.

**Porquê:** a equipa prepara uma saída para uma obra e pode misturar recursos sem voltar a escolher obra/data a cada item.

### 8.4 Entradas, devoluções e fichas antigas

Ainda existe código para entrada, novo artigo, devolução ligada à saída original, consulta antiga de stock e gestão de máquinas. Porém, o início atual do tablet só conduz à lista mista de saída ou à consulta de Recursos. Os modos antigos não têm hoje um acesso completo a partir desse início.

Consequência: não se deve demonstrar «devolver equipamento», «dar entrada num artigo novo» ou «registar dano» como fluxos acabados do tablet atual. A compra de artigo existente por fatura validada continua a criar entrada por outro percurso.

## 9. Regras de stock e equipamentos

### 9.1 Consumíveis e materiais

Disponibilidade = quantidade inicial + entradas + devoluções − saídas. Saídas futuras também descontam disponibilidade, funcionando como reserva; o custo aguarda a data efetiva. Entradas futuras não aumentam imediatamente o saldo.

Custo da saída = quantidade × valor interno guardado no movimento. A devolução credita a obra pelo valor original, evitando que uma mudança de preço distorça o histórico.

Validações: quantidade positiva e finita, valor não negativo, data válida, artigo existente, obra existente quando necessária, inteiros em artigos de precisão zero e proibição de saída superior ao disponível.

### 9.2 Bobines

Cada bobine retirada é consumida integralmente. Retirar 1 de uma referência com 25 retira apenas 1, não o lote completo. A quantidade tem de ser inteira. O movimento fica marcado como consumo integral e não tem saldo devolvível.

### 9.3 Máquinas e equipamentos

Cada ativo tem ID, número, nome, marca, modelo, estado e custo diário. A alocação associa o ativo à obra, à data de saída, à tarifa e, mais tarde, à devolução.

- Custo = número de dias inclusivos × tarifa diária.
- Dia de saída e dia de devolução contam.
- A tarifa é congelada na alocação.
- Alterar o cadastro não altera a tarifa de alocações já existentes.
- Uma alocação aberta impede nova alocação do mesmo ativo.
- Datas sobrepostas são rejeitadas.
- Cada diária cria uma linha de custo datada, permitindo filtrar por mês.
- O estado «Em obra» é inferido da alocação aberta.

**Caixas retornáveis:** apesar da intenção de controlar apenas saída/devolução e eventuais danos, o código atual continua a cobrar tarifa diária às caixas, tal como às máquinas. A regra específica de ferramenta retornável ainda não foi concluída.

## 10. Faturas & Compras e Campo

### 10.1 Consulta e registo

Indicadores de documentos, pendentes, despesas de obra e compras para stock. Pesquisa e filtros por estado e tipo. Tabela com data, fornecedor, número, obra/destino, categoria, valor e estado.

Formulário em fases: selecionar documento ou exemplo; preencher/rever fornecedor, número, data, valor e categoria; indicar destino. Despesa de obra exige obra. Compra para stock exige artigo existente e quantidade.

Categorias diretas: Alimentação, Alojamento, Combustível, Ferramentaria, Transportes e Outros. Materiais não aparece como opção de nova despesa direta, para incentivar o circuito de armazém.

### 10.2 Validação

```text
Documento registado → Por validar
  ├─ Corrigir dados → mantém pendente
  ├─ Rejeitar → sem custo/entrada de stock
  └─ Validar
       ├─ Despesa de obra → custo na obra
       └─ Compra para stock → entrada de artigo
                                   → saída posterior → custo na obra
```

Enquanto pendente, a fatura não entra no realizado nem cria stock. Pode aparecer como comprometido nas vistas orçamentais. A validação regista nome/data e impede processar novamente uma fatura que já não esteja pendente. A rejeição regista nome/data.

O código atribui João Catalão às ações administrativas de validação/rejeição; isso não é identificação autenticada. Os estados Rascunho, Por validar, Validada e Rejeitada existem no tipo, mas a criação normal começa Por validar.

### 10.3 Documento e leitura automática

A seleção de ficheiro guarda essencialmente o nome/referência no estado. O exemplo preenche campos demonstrativos. A aplicação não executa OCR real, não extrai campos de qualquer documento arbitrário e não arquiva o original de forma persistente. O painel documental mostra o contexto do registo; não equivale a um arquivo fiscal.

### 10.4 Campo

Interface simplificada para selecionar obra e enviar uma despesa com documento e dados. Termina com confirmação de envio para validação. O documento passa para a mesma coleção de faturas que João consulta.

**Porquê:** aproximar o registo de quem tem o comprovativo e concentrar a validação administrativa antes dos efeitos económicos.

## 11. Pessoas, ponto e empresas

### 11.1 Ponto semanal

Mapa por pessoa e dia; navegação entre semanas e regresso à semana atual. Pesquisa, totais de horas/viagem/custo e botão para novo registo. Uma célula abre o editor da pessoa/dia.

O editor suporta obra, data, entradas e saídas da manhã, tarde e noite, tempo de viagem e consulta do custo estimado. Horas são calculadas a partir dos intervalos. São recusadas sobreposições dentro do registo e com outros registos da mesma pessoa, incluindo datas adjacentes.

Pode haver vários registos de uma pessoa no mesmo dia ligados a obras distintas. A extra é calculada sobre o total diário da pessoa para evitar que dividir o dia por obras esconda horas extra.

### 11.2 Colaboradores

Lista pesquisável e filtro de atividade. Mostra nome, empresa/tipo, custo por hora, horas no histórico, custo estimado e estado de atividade. A ficha tem separadores Resumo, Ponto, Obras e Custos, usando os mesmos registos de ponto e custos da aplicação.

Não existe um ciclo completo de recursos humanos: contratos, férias, vencimentos, recrutamento e processamento salarial não fazem parte desta demo.

### 11.3 Empresas

Cinco cartões: ACRS e Empresas A–D. Cada um mostra tipo, trabalhadores, horas e custo. O painel da empresa apresenta política de extra, trabalhadores e obras com registos, com acesso à pessoa.

As associações são fictícias: 60% dos 201 registos ficam na ACRS, arredondados para 121; os restantes são distribuídos por A–D. Não são associações reais importadas nem um organigrama.

### 11.4 Políticas de custo

| Regra | Implementação |
|---|---|
| ACRS | +50% nas horas acima de 8 por dia |
| Empresas A–D | +50% nas horas acima de 10 por dia |
| Noturno | +25%; o editor considera 22:00–07:00 |
| Sábado | +50% |
| Domingo | +50% |
| Feriado configurado | +50% |
| Viagem | Horas de viagem acrescentadas ao custo à tarifa base |
| Precedência | Regra global → empresa → exceção individual |
| Acumulação | Configurável; por defeito desligada |

Quando acumulação está desligada, o motor compara os suplementos totais diários e aplica o maior, distribuindo-o pelas obras proporcionalmente às horas. Não soma automaticamente extra, noturno e fim de semana. O calendário de feriados começa vazio.

**Porquê:** transformar o ponto em custo por obra de forma consistente entre pessoas, empresas e análises. São cálculos operacionais demonstrativos; não constituem processamento salarial validado.

**Limites:** alterações de tarifa/política podem recalcular ponto histórico, pois não existe versionamento por vigência. O tratamento detalhado de turnos que atravessam meia-noite, suplementos e feriados necessita validação funcional adicional. Pessoas sem tarifa geram custo zero com indicação de custo por apurar, não custo comprovadamente nulo.

## 12. Orçamentos e controlo de margem

### 12.1 Conceitos

| Conceito | Significado / fórmula |
|---|---|
| Valor orçamentado | Valor comercial proposto ao cliente |
| Margem alvo | Percentagem pretendida sobre esse valor |
| Custo máximo | Valor orçamentado × (1 − margem alvo) |
| Custo atual | Soma dos lançamentos de custo realizados |
| Disponível | Custo máximo − custo atual |
| Margem atual | (Valor orçamentado − custo atual) / valor orçamentado |
| Consumo do limite | Custo atual / custo máximo |
| Comprometido | Documentos pendentes considerados na rubrica, ainda sem efeito no realizado |

Margem atual não é previsão de margem final, faturação emitida nem dinheiro recebido. Não há tesouraria ou contas a receber.

### 12.2 Página de Orçamentos

Lista por obra/cliente, modo, valor e margem, com indicadores globais e pesquisa. O formulário permite Simples (valor e margem) ou Discriminado (os mesmos dados e previsão por rubrica).

Rubricas: Mão de obra, Materiais, Ferramentaria, Transportes, Alojamento e Outros. Existe um orçamento ativo por obra, substituído ao guardar a edição.

Valida valores positivos/limites da margem e rubricas não negativas. Não impõe automaticamente que a soma das rubricas seja igual ao custo máximo. Não existem versões, propostas PDF, aprovação comercial ou orçamento detalhado por tarefas.

### 12.3 Cenário e distribuição

Nas três obras discriminadas, as rubricas iniciais representam 42% de mão de obra, 15% materiais, 18% ferramentaria, 6% transportes, 9% alojamento e 10% outros, sobre o custo máximo.

Esta distribuição aumentou a parcela de ferramentaria e reduziu outras rubricas. **Contudo, os valores comerciais continuam a ser recalculados a partir do custo inicial:** aumentar alocações também alterou alguns valores comerciais. A afirmação anterior de que os totais comerciais tinham sido integralmente preservados não é suportada pelo código. Também não houve redução dos custos reais importados para compensar o acréscimo.

### 12.4 Risco

- Saudável: abaixo de 70% do custo máximo.
- Atenção: de 70% até antes dos 80%.
- Em risco: de 80% até antes do limite.
- Orçamento ultrapassado: atingiu ou excedeu o custo máximo.
- Sem orçamento: não existe limite positivo.

**Porquê:** transformar o valor comercial e a margem desejada num limite operacional facilmente percebido.

## 13. Controlo — todos os separadores

Filtro global: Todo o histórico, Agosto 2026 ou Este mês. Indicadores de custo do período, mão de obra, ferramentaria e obras em risco. O risco usa custo acumulado da obra, não apenas o período.

| Separador | O que está disponível | Âmbito / interação |
|---|---|---|
| Obras | Top 5 por custo realizado e tabela de margem/execução | Ranking usa período; tabela financeira usa acumulado; ranking abre custos |
| Orçamento vs realizado | Obra, rubrica, previsto, realizado, comprometido, desvio | Só orçamentos discriminados; acumulado |
| Categorias | Distribuição e evolução mensal de custos em linha/área | Categoria abre lançamentos; tooltip mensal mostra valor e variação |
| Fornecedores | Ranking Top 5/10/20 e tabela de documentos, obras e despesas | Clique no ranking filtra tabela; linha abre custos do fornecedor |
| Mão de obra | Horas trabalhadas, extra, viagem e custo médio/hora; evolução mensal; extra por empresa; peso de viagem; tabela de pessoas | Extra calculada pela política diária; pessoa abre custos |
| Consumo de stock | Consumo líquido, movimentos, média, valor, saldo, cobertura e prioridades | Período próprio de 30/90/180 dias |
| Ferramentaria | Transferências, utilização, dias, custo interno, manutenção, aquisição, recuperação e resultado | Valores internos demo; manutenção acumulada não tem datas |
| Compras | Compras para stock e documentos associados | Respeita início/fim do período |

### 13.1 Gráficos

Gráficos SVG próprios, sem biblioteca externa. Cartões brancos, laranja discreto, grelha horizontal leve, eixos simples e formato português. Evolução de custos e horas usa linha/área; extra mensal usa barras; obras, empresas e fornecedores usam rankings horizontais.

O tooltip mensal pode ser consultado com rato/foco de teclado. A comparação usa o mês anterior dentro da série apresentada; se não houver base, a interface diz que não há comparação. Meses entre o primeiro e o último registo podem aparecer com zero.

### 13.2 Ferramentaria

Por ativo, as diárias imputadas são a receita/transferência interna; o custo interno é dias × custo interno diário. O resultado atual subtrai esse custo e manutenção acumulada. A recuperação divide as transferências pelo custo de aquisição.

Os valores demo de aquisição, manutenção e custo interno são gerados artificialmente. A manutenção não está datada e pode ser subtraída integralmente mesmo numa análise de um mês. Logo, o resultado não é uma rentabilidade contabilística mensal validada. O gráfico temporal de custos versus transferências continua por implementar até haver eventos datados.

## 14. Configuração

| Separador | Funcionalidade |
|---|---|
| Artigos | Pesquisa, código, descrição, variante, unidade, mínimo, aquisição e valor interno; edição de mínimo, valor interno, unidade e precisão |
| Famílias | Famílias do inventário, contagens, regra de saída e proveniência |
| Máquinas | Lista técnica e edição da tarifa diária |
| Empresas | Consulta de tipo, trabalhadores e política de extra |
| Categorias | Catálogo explicativo das rubricas de controlo |
| Regras | Política global/empresa/pessoa, suplementos, acumulação e datas de feriados |
| Utilizadores | Quadro explicativo dos perfis e experiências |

Guardar parâmetros atualiza o estado partilhado. O separador Utilizadores não cria contas nem configura permissões reais. A lista de máquinas não constitui um formulário completo de cadastro/edição de ativos.

**Porquê:** tornar regras de custo visíveis e ajustáveis sem esconder todas as decisões dentro do código.

## 15. Informação partilhada e relações entre módulos

### 15.1 Modelo comum

| Coleção | Campos principais | Quem usa |
|---|---|---|
| Obras | ID, número, nome, local, cliente, estado, datas, origem | Todos os contextos ligados à obra |
| Artigos | ID, código, família, material, tamanho, descrição, marca, quantidade inicial, preços, localização, unidade, precisão, origem | Recursos, tablet, compras, movimentos, consumo, configuração |
| Pessoas | ID, nome, tarifa, horas/dia, empresa, tipo, origem | Ponto, pessoas, empresas, custos |
| Empresas | ID, nome, interna/subcontratada, origem | Pessoas, políticas e análises |
| Ponto | Pessoa, data, obra, intervalos, horas, viagem, noturno, referência da origem | Ponto, obra, pessoa, empresa, custos |
| Faturas | Documento, fornecedor, número, data, obra, categoria, valor, tipo, estado, artigo/quantidade e validação | Faturas, Campo, compras, obra, comprometido, custos |
| Movimentos | Tipo, artigo, obra, quantidade, valor, data efetiva/registo, utilizador, origem e consumo integral | Armazém, stock, consumo, obra, custos |
| Ativos | Identificação, nome, marca/modelo, estado, tarifa, aquisição/manutenção/custo interno | Recursos, alocações, obra, controlo, configuração |
| Alocações | Ativo, obra, saída, devolução, tarifa congelada e utilizador | Disponibilidade, equipamentos em obra, custo diário |
| Orçamentos | Obra, valor, margem, modo e rubricas | Dashboard, obras, orçamento, controlo |
| Configurações | Mínimos, valores internos, políticas e feriados | Stock, ponto e parâmetros |
| Custos manuais | Obra, categoria, descrição, quantidade, valor e data | Motor de custos; dano/perda em componente legado |

Não existe uma tabela independente e persistente de custos. O livro de custos é calculado a partir das coleções operacionais.

### 15.2 Origem dos custos

```text
Fatura validada de despesa ───────────────────────┐
Ponto × tarifa × política + viagem ───────────────┤
Saída de artigo / crédito por devolução ──────────┤
Alocação de ativo → uma linha por diária ─────────┼→ Livro de custos
Dano/perda ou outro custo manual ────────────────┘       │
                                                       ├→ Obra
Orçamento + margem alvo ────────────────────────────────┼→ Risco / margem
                                                       ├→ Dashboard
                                                       ├→ Pessoa / Empresa
                                                       └→ Controlo
```

Cada custo tem obra, data, origem, ID da origem, descrição, categoria, quantidade, valor unitário, total e utilizador. Quando disponível, preserva ficheiro/folha/linha de origem. Isso permite ir do indicador ao lançamento.

### 15.3 Matriz dos efeitos

| Ação | Alteração primária | Reflexos partilhados |
|---|---|---|
| Criar/editar obra | Obras | Listas, seletores e detalhe |
| Alterar valor/margem | Orçamentos | Custo máximo, saldo, margem/risco e dashboards |
| Guardar ponto | Ponto | Custo por obra, pessoa, empresa e Controlo |
| Alterar política | Configurações | Recalcula custos de ponto e agregados |
| Registar fatura pendente | Faturas | Pendentes, detalhe da obra e comprometido |
| Validar despesa | Estado da fatura | Custo, categoria, fornecedor, obra e margem |
| Validar compra | Fatura + entrada de stock | Disponibilidade e compras; sem custo direto de obra |
| Saída de consumível | Movimento | Saldo, consumo, custo, atividade e obra |
| Devolução de consumível, no motor | Movimento ligado à saída | Saldo reposto e crédito na obra |
| Alocar ativo | Alocação | Disponibilidade, obra e diárias |
| Devolver ativo, no componente legado | Data de fim | Termina acumulação após o dia de devolução |
| Alterar mínimo | Configuração | Alertas de reposição e dashboard |
| Alterar valor interno | Configuração | Valorização atual e futuras saídas; movimentos antigos mantêm valor |

**Distinção essencial:** as alterações propagam-se na mesma aplicação aberta, não entre utilizadores ou dispositivos.

## 16. Decisões e respetivo motivo

| Decisão | Motivo |
|---|---|
| Obra como centro | Permite reunir operação e economia num contexto comum |
| Unificar armazém na navegação | Corresponde à forma como a equipa pensa entradas, saídas e recursos |
| Manter modelos diferentes de artigo/ativo | Stock por quantidade e rastreio individual têm regras distintas |
| Separar estado e alerta | «Em obra» não significa o mesmo que «abaixo do mínimo» |
| Máquinas por dia | Regra confirmada da consultoria |
| Tarifa congelada na alocação | Preserva o acordo de custo no histórico |
| Bobine integral por unidade retirada | Evita controlo irreal de sobras e o erro de retirar todas as bobines |
| Data efetiva distinta do registo | Permite lançar posteriormente o que aconteceu no terreno |
| Validar fatura antes do efeito | Evita custos/stock definitivos com documentos por rever |
| Clientes numerados e marcados demo | Torna as páginas legíveis sem afirmar clientes reais |
| Remover responsável | Pedido explícito: obra não tem responsável individual associado |
| Lista mista no tablet | Reduz repetição de obra, data e confirmação |
| Botões largos | Facilita uso por toque em armazém |
| Gráficos discretos e tabelas preservadas | Apoiam leitura sem tirar acesso ao detalhe operacional |
| Estado local reiniciado ao recarregar | Permite experimentar o cenário repetidamente |

## 17. O que foi preservado do Power BI

A análise registada do PBIX identificou seis páginas, nove tabelas, 91 colunas, 26 medidas, dez relações e cerca de 27,5 mil linhas no modelo completo. Esse total não é a dimensão carregada nesta demo.

Perguntas preservadas: custo por obra/pessoa/período, horas normais e extra, noturno, viagem, custo médio/hora, despesas por fornecedor/categoria e consulta de origem. A demo distribui essas perguntas pelas páginas de Obra, Ponto, Pessoas e Controlo.

Stock, movimentos, alocações, orçamento e margem alvo são a extensão operacional proposta. Não se afirma equivalência de resultados com todas as medidas do PBIX: falta exportar e reconciliar integralmente o DAX, e os custos demo aplicam regras e parâmetros próprios.

## 18. Limitações identificadas na revisão atual

Estes pontos são pendências efetivas; não devem ser apresentados como concluídos só porque foram mencionados em respostas anteriores.

1. **Fichas em Recursos:** a tabela unificada não abre detalhe adaptativo nem ações do recurso.
2. **Histórico do armazém:** Movimentos ainda não inclui alocações/devoluções de equipamentos.
3. **Entradas/devoluções no tablet:** os componentes legados existem, mas perderam o percurso de acesso com o novo início.
4. **Máquinas e danos:** o componente antigo tem alocar/devolver/dano, mas a rota antiga agora mostra Recursos; não há acesso normal a esse detalhe.
5. **Ferramentas retornáveis:** caixas continuam a gerar custo diário, em vez de regra distinta de rastreio/dano.
6. **Tipos/famílias de ativos:** inferidos por texto e não por cadastro explícito; Recursos e tablet usam classificações diferentes.
7. **Links de equipamentos:** alguns indicadores contam todos os ativos, mas abrem filtro Máquinas, excluindo caixas/geradores/compressoras classificadas de outra forma. O link de reparação não aplica um filtro de estado.
8. **Reservas de ativos:** uma alocação futura aberta pode aparecer imediatamente como «Em obra»; não há estado visual de reserva consolidado.
9. **Obras novas:** ID único fixo impede várias criações independentes na mesma sessão.
10. **Precisão:** a apresentação aceita até três casas, mas o motor de saldo/devolução arredonda a duas. Materiais medidos precisam de precisão consistente de ponta a ponta.
11. **Lista mista:** existe validação final no motor, mas faltam testes específicos do percurso completo, navegação de retorno, entradas numéricas inválidas e estados vazios de maquinaria indisponível.
12. **Documento de saída:** não existe guia/lote persistente que una as linhas. A lista gera movimentos e alocações independentes, sem ID comum de operação.
13. **Custo inicial do tablet:** soma materiais e uma diária; precisa de legenda cuidadosa para saídas futuras e não representa o custo total final dos ativos.
14. **Proveniência do Excel:** esclarecer a correção de Miguel e confirmar/remigrar os JSONs, conforme secção 2.
15. **Orçamentos:** o aumento de alocações alterou valores comerciais gerados; não foi mantido um total comercial fixo. As rubricas também não têm imposição de soma igual ao custo máximo.
16. **Comprometido:** usa categoria da fatura em comparações que nem sempre seguem a mesma normalização do realizado; não equivale a encomendas/compromissos financeiros completos.
17. **Categorias analíticas:** a distribuição visual usa lista fixa e deve ser reconciliada com todas as categorias do motor, incluindo Transportes, para garantir cobertura integral.
18. **Mão de obra:** rever consistência entre resumo da obra, KPI médio/hora e detalhe quando se distribui um dia por várias obras. Nem todas as vistas usam necessariamente o mesmo denominador de horas/viagem.
19. **Tarifas/políticas históricas:** ponto não tem vigência congelada; alterações podem recalcular o passado.
20. **Ferramentaria:** manutenção acumulada sem data distorce análise por período; não há depreciação/contabilidade de ativos completa.
21. **Permissões:** perfis visuais não são autorização. Validação/rejeição atribui João no código, não uma identidade verificada.
22. **Materiais diretos:** o formulário remove a opção Materiais, mas não existe uma regra de negócio geral capaz de impedir toda a classificação incorreta, incluindo dados legados ou «Outros».
23. **Faturas:** sem deteção robusta de duplicados, IVA, notas de crédito, linhas múltiplas, estorno ou workflow por montante.
24. **Persistência:** sem base de dados, documentos duráveis, sincronização, autenticação, cópias de segurança ou auditoria imutável.
25. **Dia atual:** o livro de custos atualiza a data de referência ao carregar; não existe relógio contínuo para atravessar a meia-noite numa sessão longa. Alguns textos de data da demo também são fixos.
26. **Dimensões de toque:** existem melhorias reais, mas algumas regras mobile e ações fora do painel antigo não herdam todas as alturas divulgadas anteriormente.

## 19. Input da ACRS e decisões ainda necessárias

### 19.1 Dados e regras do negócio

- Confirmar fonte real de obras, ponto, pessoas e faturas e reconciliar com o PBIX.
- Cadastro real de ativos, identificações, famílias, estados e localização atual.
- Quantidades, variantes, unidades e precisão do inventário.
- Relação real de cada pessoa com a empresa e tarifas aplicáveis.
- Calendário de feriados e regra de acumulação dos suplementos.
- Confirmação de noturno, turnos que atravessam dias, viagens e tratamento de exceções.
- Tarifas diárias, preços internos, manutenção datada, aquisição e método de custo interno.
- Orçamentos comerciais reais, margem pretendida e rubricas por obra.
- Mínimos, prazos de entrega, fornecedores preferenciais e descontos por volume.
- Histórico de entradas, saídas, devoluções, perdas e alocações, caso exista.
- Aprovação de faturas: quem valida, rejeita, corrige ou estorna e com que limites.
- Circuito de danos/perdas e ferramentas retornáveis.
- Papel de viaturas, contentores e eventuais subarmazéns/localizações em obra.

Clientes reais podem continuar fictícios durante a demonstração. Responsável por obra não é um dado em falta: foi deliberadamente removido por Miguel.

### 19.2 Trabalho técnico que não depende de esperar pela ACRS

Restaurar percursos de devolução/entrada, ligar fichas aos recursos, unificar o histórico visível, corrigir IDs de novas obras, alinhar precisão, melhorar filtros, testar lista mista e consolidar regras de classificação. Estes são ajustes de implementação, não bloqueios de input.

Base de dados, autenticação, armazenamento de documentos, permissões por ação, testes de integração e migração são a fase de robustecimento. Exigem decisões técnicas da equipa, além da validação dos dados do cliente.

## 20. Mapa técnico para continuidade

| Ficheiro / pasta | Responsabilidade |
|---|---|
| `app/[[...slug]]/page.tsx` | Lista de rotas estáticas e entrada da aplicação |
| `components/application.tsx` | Mapa de páginas e encaminhamento por perfil |
| `components/shell.tsx` | Sidebar, grupos, logótipos, cabeçalho e perfil |
| `components/store.tsx` | Estado partilhado da sessão e livro de custos calculado |
| `lib/initial.ts` | Montagem dos dados iniciais e parâmetros demo |
| `data/demo/scenario.ts` | Políticas, empresas, ativos, alocações e movimentos demo |
| `data/source/` | Dados extraídos e resumos de origem |
| `types/index.ts` | Contratos de dados de todas as entidades |
| `lib/engine.ts` | Custos, margem, saldo, validações, alocações e ponto |
| `lib/format.ts` | Formatação, datas, pesquisa, somas e IDs |
| `components/dashboard.tsx` | Dashboards dos perfis |
| `components/works.tsx` | Lista, formulário e detalhe de obra |
| `components/resources.tsx` | Página principal do armazém e catálogo unificado |
| `components/warehouse.tsx` | Seletores, movimentos, tablet atual e fluxos legados |
| `components/machines.tsx` | Gestão antiga de alocação, devolução e danos |
| `components/invoices.tsx` | Faturas, validação, Campo e consulta documental |
| `components/people.tsx` | Ponto, pessoa e empresa |
| `components/budgets.tsx` | Formulário e consulta de orçamento |
| `components/control.tsx` | Análises por obra, categoria, fornecedor, pessoa, consumo e ativos |
| `components/control-charts.tsx` | Séries mensais e rankings SVG |
| `components/costs.tsx` | Tabela, distribuição e painel de origem de custos |
| `components/settings.tsx` | Parâmetros e políticas |
| `components/ui.tsx` | Elementos de interface reutilizados |
| `app/globals.css` | Estilo, responsividade, tablet e navegação |
| `public/` | Logótipos e recursos estáticos |
| `scripts/` | Extração de dados e servidor de ficheiros da exportação |
| `tests/engine.test.ts` | Testes de regras operacionais |
| `docs/` | Contexto, blueprint, análises e este documento |

Comandos do projeto: `npm run dev`, `npm run typecheck`, `npm test`, `npm run build` e `npm start`. O build exporta para `out/`; o servidor local serve essa exportação. Uma alteração ao código exige reconstruir a exportação quando se usa esse servidor, em vez do servidor de desenvolvimento.

## 21. Verificação e roteiro de demonstração

As execuções recentes registaram compilação estática sem erros e 15 testes de motor aprovados. Testam inventário, saída/devolução, saldo inválido, bobines, fatura pendente/validada, compra sem custo direto, reserva futura, alocação/tarifa, distribuição diária, extra por empresa e obra, conflitos de horário e margem. Não são uma cobertura end-to-end de todas as páginas.

Roteiro sugerido para conferir ligações:

1. João: observar valor, limite, custo e risco no dashboard e abrir uma obra com alerta.
2. Obra: consultar um custo e a sua origem; percorrer pessoas, materiais, equipamentos e valor orçamentado.
3. Tablet: selecionar obra, consumível, quantidade, adicionar outro, maquinaria disponível, terminar lista, data e confirmar.
4. Voltar à mesma obra sem recarregar e observar os novos movimentos/alocação e custos.
5. Recursos: conferir saldo do consumível e estado/localização do ativo.
6. Faturas: adicionar despesa pendente; confirmar ausência de custo; validar; confirmar novo custo na obra.
7. Compra para stock: registar/validar compra de artigo existente e confirmar entrada sem custo direto na obra.
8. Ponto: acrescentar registo e observar custo por pessoa, empresa e obra.
9. Orçamento: alterar margem alvo e observar o novo custo máximo/risco.
10. Controlo: comparar período, abrir fornecedor, consultar extra e cobertura de stock.
11. Recarregar: confirmar reposição do cenário, explicando a natureza da demo.

Os fluxos sem acesso integrado da secção 18 devem ser corrigidos antes de serem incluídos no roteiro como operações disponíveis.

## 22. Documentos relacionados

- [Contexto operacional](ACRS___Contexto_Operacional.pdf)
- [Blueprint funcional](ACRS___Blueprint_Funcional_v0_1.pdf)
- [Análise funcional](analise-funcional.md)
- [Análise do Excel](analise-excel.md)
- [Análise do inventário](analise-inventario.md)
- [Análise do Power BI](analise-power-bi.md)
- [Estado anterior da demo](estado-demo-v0.2.md)

O documento de estado anterior é histórico: contém referências a responsáveis, navegação antiga e funcionalidades cujo acesso mudou. Para o estado atual da demo, usar este documento em conjunto com o código; para requisitos do produto final, usar o Blueprint e as decisões posteriores de Miguel.
