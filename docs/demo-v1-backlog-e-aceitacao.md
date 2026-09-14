# Demo V1 — backlog, aceitação e passagem à equipa

Revisão documental: 14/09/2026. Fonte principal: [Caderno de Encargos](ACRS___Caderno_Encargos___DEMO.pdf). As páginas abaixo são as páginas físicas do PDF (capa incluída). **Todos os itens são requisitos a verificar, não declarações de conclusão.** A equipa define tecnologia, divisão de tarefas, branches e PRs.

## Backlog rastreável

| ID | Entrega | Aceitação mínima | Fonte | Marco do caderno |
|---|---|---|---|---|
| V1-01 | Git e organização | Repositório estruturado, colaboração e arquitetura acordadas; responsabilidades repartidas pela própria equipa | pp. 3, 24, 32 | 14/09 |
| V1-02 | Persistência | Principais entidades em base de dados; recarregar preserva registos; segundo dispositivo consulta os mesmos dados | pp. 6–7 | 16/09 |
| V1-03 | Aplicação online | URL estável, staging/demo, ambiente local, variáveis configuradas, deployment ligado ao Git e login | p. 6 | 16/09 |
| V1-04 | Autenticação e autorização | Quatro perfis reais e contas demo; restrições na API/dados, inclusive acesso direto; política de leitura, criação, edição, validação, rejeição e configuração | pp. 5, 7–8 | 16–18/09 |
| V1-05 | Documentos e OCR | Upload privado persistente; consulta autorizada; OCR real por interface substituível; duas alternativas avaliadas; revisão humana e estados explícitos | pp. 8–11 | 18/09 |
| V1-06 | Terreno → Secretariado → Obra | Envio simples; receção, revisão, correção, categoria/obra e validação/rejeição; custo apenas após validar | p. 11 | 18/09 |
| V1-07 | Armazém/Ferramentaria | Catálogo unificado, ficha por recurso, entrada, saída, devolução, ajuste, alocação/retorno de ativo, dano/perda; histórico integrado e operação agrupada | pp. 12–16 | 18/09 |
| V1-08 | Compras para stock | Digitalizar fatura; reconhecer/corrigir fornecedor e linhas; associar artigos; validar e entrar em stock, sem custo direto de obra | p. 12 | 18/09 |
| V1-09 | Obra e fonte central de custos | Ponto, fatura, stock, ativo, dano/perda e ajuste convergem para a mesma obra; Dashboard/Obra/Controlo usam a mesma fonte | pp. 16–18 | 18/09 |
| V1-10 | Orçamento, margem e risco | Valor vendido, margem alvo, máximo, realizado, disponível, utilização e estados Saudável/Atenção/Em risco ligados à execução | p. 18 | 18/09 |
| V1-11 | Ponto persistente | Pessoa/empresa/obra/horários/horas/viagem/custo guardados; regras por empresa; alimenta custos | pp. 18–19 | 18/09 |
| V1-12 | Testes e apresentação | Percursos completos, perfis e dois dispositivos testados; dados e roteiro preparados; limitações explícitas | pp. 20, 29–31 | 18/09 |
| V1-13 | Feedback e revisão final | Corrigir bugs, incoerências, permissões e fluxos; preparar narrativa e questões para a ACRS | pp. 26–28 | 21/09 |

Auditoria é transversal (p. 19): guardar utilizador, ação, entidade, data/hora e estados anterior/posterior quando relevantes. Não a omitir por não aparecer isolada nos 13 blocos executivos.

## Estado frontend versus V1

O [manual de 13/09](manual-completo-sistema-demo.md) é a base histórica para identificar o trabalho existente. Não foi feita nesta atualização uma nova auditoria integral ao código deste repositório.

| Base descrita no manual | Exigência nova/completude a verificar |
|---|---|
| Estado React em memória | Base persistente, partilha entre utilizadores e dispositivos |
| Perfis visuais e navegação condicionada | Login e quatro funções com autorização no backend |
| Ficheiro selecionado/preenchimento de exemplo | Documento guardado, OCR real, workflow e validação auditada |
| Compras com artigo único | Linhas de fatura, associação de artigos e correção |
| Lista de saída mista no tablet | ID comum persistente e consulta/correção/auditoria do conjunto |
| Recursos sem ficha acessível e percursos de retorno incompletos | Fichas acessíveis e todos os movimentos integrados |
| Cálculo central em memória | Fonte de custos comum persistente/coerente com os registos e datas |
| Testes de motor | Testes ponta a ponta, autorização e operação em dois dispositivos |

A quantidade de páginas frontend existentes não é a percentagem de conclusão da V1. A equipa deve recolher evidência demonstrável por bloco e apresentar os bloqueios.

## OCR: comparação mínima

O caderno exige testar pelo menos duas alternativas; cita LlamaParse/LlamaExtract e Google Document AI como exemplos, sem impor fornecedor. Não contratar serviços nesta atualização documental.

Amostra sugerida (25 documentos): 5 faturas de material, 5 recibos de alimentação, 5 documentos de combustível, 5 fotografias de pior qualidade e 5 documentos multilinha. Verificar fornecedor, NIF, número, data, total, IVA, linhas, quantidades e preço unitário; registar qualidade e custo/consumo de créditos. O caderno não fixa uma percentagem de precisão para aprovação.

Guardar documentos em armazenamento privado e ligar ao registo, autor e data de upload. Restringir consulta. Conservar resultado bruto, dados finais corrigidos, confiança quando disponível, autor/data de validação. O desenho deve permitir substituir o fornecedor de OCR.

## Operação agrupada e efeitos

Uma saída com vários consumíveis, caixas e máquinas deve ter um identificador comum. Cada linha conserva a sua regra de custo e rastreabilidade. O caderno dá um exemplo de referência `SAIDA-2026-000184`; o formato exato não é obrigatório.

- Compra validada → inventário; não cria despesa direta de obra.
- Consumo validado → stock e custo da obra.
- Devolução elegível → reposição e correção do custo correspondente.
- Ativo alocado → indisponibilidade e custo diário até devolução.
- Bobine → consumo integral por unidade retirada, sem segunda imputação.
- Dano/perda/ajuste → movimento rastreável com custo quando aplicável.

Como critério técnico derivado para preservar estes efeitos, testar que repetir uma confirmação não duplica stock/custos e que falhas não deixam apenas parte da operação gravada. Isto operacionaliza a consistência exigida; o mecanismo transacional é escolha da equipa.

## Testes mínimos do caderno

| Teste | Percurso e resultado observável |
|---|---|
| T01 | Terreno envia fatura → Secretariado revê/corrige/valida → Administração vê custo na obra; antes de validar não há esse custo |
| T02 | Armazém valida compra → stock aumenta pelas linhas; compra não aumenta diretamente custo da obra |
| T03 | Saída de consumível → stock reduz e custo aparece na obra |
| T04 | Alocação de máquina → indisponível e custo diário na obra |
| T05 | Devolução de máquina → termina acumulação futura e atualiza disponibilidade |
| T06 | Administração altera valor/margem → máximo, saldo e risco atualizam de forma consistente |
| T07 | Secretariado não obtém margem/orçamento/custo máximo pela interface, URL direta ou API |
| T08 | Dois navegadores/dispositivos consultam a mesma alteração; recarregar preserva-a |

Complementos derivados dos restantes requisitos: testar rejeição e OCR_FAILED sem efeitos definitivos; armazenamento inacessível a utilizador não autorizado; devolução de consumível; ajuste/dano; consulta do grupo de saída; auditoria de edição/validação; proteção equivalente dos perfis Armazém e Terreno.

## Roteiro de apresentação

1. Entrar como Terreno, selecionar obra e enviar fotografia de fatura.
2. Entrar como Secretariado, rever OCR, corrigir e validar.
3. Entrar como Administração, abrir a obra e confirmar o custo.
4. Entrar como Armazém, digitalizar compra e confirmar entrada no inventário.
5. Fazer saída de material para obra e verificar stock e custo.
6. Alocar máquina/equipamento; verificar indisponibilidade e custo diário.
7. Devolver o equipamento e confirmar fim da acumulação.
8. Alterar orçamento/margem como Administração e confirmar risco.
9. Entrar como Secretariado e comprovar que dados económicos restritos continuam inacessíveis.
10. Demonstrar persistência com recarregamento e consulta noutro dispositivo.

Os passos 1–9 condensam o roteiro de 20 passos das pp. 29–30; o passo 10 acrescenta a evidência exigida no critério geral e no teste T08. Registar evidência/limitações, sem dar um fluxo como concluído só por existir a página.

## Marcos

| Data de 2026 | Resultado esperado |
|---|---|
| 14 de setembro | Ler documentos, rever demo, organizar Git/branches, alinhar arquitetura, repartir trabalho e iniciar desenvolvimento |
| 15 de setembro | Desenvolvimento autónomo; levantar bloqueios imediatamente; sem ponto formal |
| 16 de setembro | Controlo de 50%: pelo menos metade do backlog funcional concluído ou demonstrável; deployment, base de dados, perfis avançados, persistência parcial e estado do OCR |
| 17 de setembro | Fechar fluxos, integração, erros e experiência; sem ponto formal |
| 18 de setembro | 100% Demo Ready para revisão interna de ponta a ponta; apresentar decisões, limitações e questões ACRS; recolher feedback da restante equipa |
| 21 de setembro | Aplicar feedback, corrigir permissões/bugs/incoerências e preparar narrativa |
| 21–22 de setembro | Após validação interna, contactar ACRS com link, contas, roteiro, questões, decisões e proposta de fase seguinte |

O histórico da conversa referia apresentação em 23/09. O caderno agora define contacto em 21–22/09, mas não fixa uma nova data de demonstração ao cliente. Não confundir contacto, entrega interna e reunião com o cliente. O Contexto refere ambição de arranque operacional em janeiro sem indicar o ano.

## Questões por fechar com a ACRS

1. Nomes das quatro subcontratadas e correspondência dos trabalhadores.
2. Hora extra externa: 11.ª ou 12.ª hora.
3. Domingo/feriados: +50% ou +100%.
4. Acumulação de suplementos ou aplicação do maior/prioridade.
5. Valores internos, margens e regras por família/artigo.
6. Tarifa diária de cada máquina/equipamento.
7. Ferramentas retornáveis: apenas rastreabilidade ou custo interno.
8. Inventário inicial, reconciliação, unidades e precisão.
9. Contentores como localização ou operação própria; evitar dupla imputação.
10. Viaturas e prevenção de duplicação com custos não produtivos.
11. Quem valida, corrige, rejeita e estorna faturas; limites por valor.
12. Secretariado responsável ou não pela introdução/revisão de ponto.

O Contexto acrescenta a necessidade de confirmar a interpretação da margem interna da ferramentaria e a sua distinção do resultado consolidado. A dúvida prévia sobre a proveniência do Excel desta demo também deve ser esclarecida antes da migração. Estas questões não bloqueiam todo o desenvolvimento; usar parâmetros demonstrativos identificados, sem os declarar regras definitivas.

## Fora do âmbito

Contabilidade, faturação fiscal, processamento salarial, CRM, tesouraria, RH completo, IA para gerar orçamentos, previsão automática de margem, depreciação contabilística de ativos, compras automáticas, offline completo, gestão definitiva de viaturas e gestão avançada de contentores/subarmazéns.

## Definição de pronto

Link funcional com login; registos persistentes; operações ligadas entre utilizadores; despesa do terreno validada no secretariado e refletida na obra; compra alimenta stock; saída alimenta custo; ativo aloca e regressa; orçamento acompanha execução; permissões protegem os dados; testes e roteiro executados; limitações e decisões pendentes explícitas. Não implica um ERP completo.
