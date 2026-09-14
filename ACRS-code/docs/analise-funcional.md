# ACRS — análise funcional para a Demo V1

Revisão documental de 14/09/2026, baseada no [Contexto Operacional](ACRS___Contexto_Operacional.pdf), 27 páginas, e no [Caderno de Encargos](ACRS___Caderno_Encargos___DEMO.pdf), 32 páginas. A análise frontend anterior foi preservada em `historico/`.

## Objetivo e fronteira da fase

O sistema atual já contém informação e reporting em Excel/Power BI. A necessidade é ligar o registo administrativo à operação física, com a obra como entidade central. Preservar perguntas de gestão e integrar ponto, viagens, despesas, inventário, máquinas e orçamento.

A Demo V1 deixa de ser exclusivamente frontend: deve funcionar num URL real, ter dados persistentes partilhados entre dispositivos, login real, autorização no backend, documentos guardados e OCR integrado com revisão humana. A escolha técnica cabe à equipa; PostgreSQL é uma possibilidade citada, não uma tecnologia imposta. A responsabilidade é conjunta, sem atribuição individual de tarefas pelo documento.

Esta descrição é o objetivo da entrega. O [manual anterior](manual-completo-sistema-demo.md) descreve uma demo com estado em memória e não deve ser reescrito como se a V1 estivesse concluída.

## Quatro circuitos de aceitação

1. Terreno submete documento para uma obra → Secretariado revê e valida → a despesa integra o custo da obra.
2. Armazém submete compra → OCR e validação das linhas → entrada no inventário, sem custo direto da obra.
3. Armazém envia recurso para obra → altera stock/disponibilidade e imputa custo → devolução corrige ou termina os efeitos conforme o recurso.
4. Administração abre obra → compara valor orçamentado, margem alvo, custo máximo, custo atual, saldo e risco.

## Perfis reais

| Perfil V1 | Acesso e operações | Limites |
|---|---|---|
| Administração | Visão global; obras, orçamento, custos, validação, ponto, armazém, configuração e controlo | Acesso financeiro global |
| Secretariado | Receber documentos, rever OCR, corrigir, validar/rejeitar e apoiar registos | Sem orçamento, margem, lucros, custo máximo ou dashboards económicos; responsabilidade pelo ponto ainda a confirmar |
| Armazém | Inventário, movimentos, alocações/devoluções e digitalização de compras | Apenas informação necessária à operação; sem dados económicos reservados |
| Terreno | Selecionar obra, fotografar/submeter despesa e confirmação básica | Interface mínima; sem dados económicos reservados |

As restrições abrangem API, acesso direto a rotas e camada de dados. Não basta esconder elementos. Os cinco perfis visuais antigos (João, Vítor, Gerência, Armazém e Campo) não constituem o modelo de autorização exigido. A migração deve mapear contas para funções sem deduzir permissões apenas dos nomes.

## Informação comum e cálculo

Entidades: utilizador, perfil/permissão, obra, orçamento, empresa, pessoa, ponto, fornecedor, categoria, documento/fatura, linha de fatura, recurso, movimento de stock, máquina/equipamento, alocação e auditoria. Acrescentar identificador comum para cada operação física com vários recursos e uma fonte central de eventos/movimentos de custo.

Cada custo identifica obra, categoria, origem, ID de origem, data efetiva, descrição, quantidade, valor unitário e total. Dashboard, Obra e Controlo leem a mesma fonte. Ponto, faturas validadas, movimentos, alocações, danos/perdas e ajustes podem originar custos.

- **Valor orçamentado:** valor comercial vendido ao cliente.
- **Margem alvo:** percentagem pretendida sobre esse valor.
- **Custo máximo:** valor orçamentado × (1 − margem alvo).
- **Custo atual:** custos efetivamente registados/validados até à data de leitura.
- **Disponível:** custo máximo − custo atual.
- **Utilização do limite:** custo atual ÷ custo máximo, quando este é positivo.
- **Margem atual:** (valor orçamentado − custo atual) ÷ valor orçamentado, quando positivo; não é previsão final.

Os estados mínimos são Saudável, Atenção e Em risco. O caderno não fixa um limiar numérico para Atenção: não apresentar uma convenção da demo como requisito formal. Valores ausentes/zero não devem originar divisões inválidas.

## Armazém unificado

Um catálogo comum, com filtros por tipo e fichas adaptativas. Estados operacionais e alertas de mínimo são conceitos distintos. Cada recurso abre detalhe com identificação, disponibilidade, localização/obra, preço aplicável, mínimo, histórico, manutenção e danos conforme o tipo e as permissões.

| Recurso | Regra |
|---|---|
| Material/consumível | Quantidade × valor interno; saída reduz stock; devolução elegível repõe stock e corrige o custo |
| Máquina/equipamento | Identificação individual; tarifa por dia; alocação e devolução; sem dupla ocupação |
| Ferramenta/caixa retornável | Saída e devolução; verificar integridade; custo de falta/dano quando aplicável; política de cobrança ainda a confirmar |
| Bobine | Cada bobine retirada é consumida integralmente na primeira saída; regresso físico com sobra não cria novo stock contabilizável nem nova imputação |

Entradas, saídas, devoluções, ajustes, alocações, retornos de ativos e danos/perdas devem aparecer num histórico integrado. Cada movimento conserva obra, recurso, quantidade, data efetiva, data de registo, utilizador, origem, destino, valor e documento relacionado. Datas de registo e de ocorrência são diferentes.

Uma saída com vários recursos deve ter um ID comum, para consulta, correção, auditoria e futura guia. «Responsável» neste contexto identifica o autor/rastreabilidade da operação; não reintroduz um responsável obrigatório na ficha da obra.

O tablet mantém a intenção já definida por Miguel: obra → consumível/maquinaria → família → artigo → quantidade → adicionar outro (regressa ao tipo) / terminar lista → data → confirmar saída. A V1 deve completar também os restantes movimentos exigidos pelo caderno. Usar botões amplos e campos adaptativos.

O Contexto admite «Outro» para artigos/despesas não catalogados, mas também determina que todo o material operacional passe pelo stock, mesmo se entregue fisicamente na obra. Interpretação conciliadora para implementação: permitir registo/cadastro manual do material com movimento de inventário; reservar despesa direta para despesas que não sejam material operacional. Validar detalhes do cadastro extraordinário com a equipa/ACRS.

## Documentos e validação

Fotografia/PDF → armazenamento privado → extração estruturada → revisão → correção → validação/rejeição. Extrair fornecedor, NIF, número, data, subtotal, IVA, total e linhas com quantidade/preço, quando possível. Guardar bruto do OCR, valores validados, confiança disponível, autor e data da validação.

Estados recomendados no Caderno: UPLOADED → PROCESSING → NEEDS_REVIEW → CONFIRMED; alternativas OCR_FAILED e REJECTED. Só a confirmação produz os efeitos económicos/de stock correspondentes. O Secretariado trata despesa de obra; a matriz final de autorização da validação de compras, correções e estornos precisa de confirmação.

Testar pelo menos dois fornecedores de OCR através de uma interface substituível (por exemplo `extractInvoice(file)`). Os serviços citados são exemplos. Usar volumes mínimos/free tiers e não assumir contratação paga como parte desta atualização documental.

## Ponto e mão de obra

Priorizar registo administrativo, sem impor aplicação de ponto a todos os trabalhadores. Persistir pessoa, empresa, obra, horários, horas normais/extra/noturnas, viagem e custo. A parametrização-base deve ser por empresa; não transformar exceções individuais da demo em regra principal.

Referências de trabalho: ACRS extra a partir da 9.ª hora +50%; subcontratadas a partir da 11.ª +50%; noturno +25%; sábado +50%; domingo/feriados +50%. Os novos documentos explicitam confirmação pendente de 11.ª versus 12.ª hora, 50% versus 100% aos domingos/feriados e acumulação versus prioridade de suplementos. A viagem entra no custo; os parâmetros finais devem ser validados.

## Controlo e alcance

Preservar custos/despesas por obra, pessoas, categorias e fornecedores; horas, extras, rácio de extras, custo médio/hora, viagem e evolução temporal. Integrar orçamento versus realizado, margem/risco, consumo, cobertura, utilização de máquinas e leitura económica da ferramentaria. Transferência interna não é faturação fiscal nem lucro consolidado adicional.

Ficam fora desta V1 contabilidade, faturação fiscal, salários, CRM, tesouraria, RH completo, IA de orçamentação, previsão automática de margem, depreciação contabilística, compras automáticas, offline completo, solução definitiva de viaturas e gestão avançada de contentores.

Ver [backlog e aceitação](demo-v1-backlog-e-aceitacao.md) para marcos, testes e questões em aberto.
