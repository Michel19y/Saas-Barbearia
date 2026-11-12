# Barbearia SaaS — Documento de Requisitos

> Documento de requisitos gerado por IA, validado por humanos.
>
> Sistema selecionado para executar o exercício: **SaaS de agendamento multi-tenant para barbearias** (código deste repositório). Este documento aplica o método de descoberta de requisitos (entrevista simulada → personas → RFs/RNFs → histórias de usuário) a esse sistema, como CRUD equivalente ao estudo de caso apresentado em aula.
>
> Detalhes técnicos de stack e como rodar o projeto estão em [ARQUITETURA.md](./ARQUITETURA.md).

## 01 · Contexto

Donos de barbearias pequenas e médias hoje organizam a agenda por WhatsApp, caderno ou planilha, o que gera conflitos de horário, esquecimento de clientes e nenhum histórico confiável de atendimentos. O sistema é um SaaS multi-tenant (cada barbearia é um cliente isolado) que permite ao dono cadastrar serviços e profissionais, montar a agenda, receber agendamentos de clientes finais por uma página pública, importar o histórico de atendimentos que já existia em planilha, e futuramente sincronizar a agenda com o Google. Restrições: equipe pequena e sem TI própria, orçamento de hospedagem enxuto, e dados de clientes (nome, telefone) sujeitos à LGPD.

## 02 · Persona

**Marcos, 34 anos — dono de uma barbearia com 3 cadeiras e 2 profissionais contratados.**

- **Dor**: perde e duplica agendamentos porque tudo é combinado por WhatsApp; não tem visão da agenda dos profissionais em um lugar só; não sabe quanto faturou por serviço porque o controle de atendimentos passados está espalhado em planilhas separadas.
- **Cenário**: atende no balcão e no celular entre um corte e outro — não tem tempo nem paciência para aprender um sistema complicado; já usa Google Sheets por hábito.
- **Métrica de sucesso**: zero conflito de horário na agenda e reduzir pela metade o tempo que gasta remarcando/confirmando horário por WhatsApp em 30 dias de uso.

*(Personas secundárias consideradas e descartadas como primária: a recepcionista que opera o sistema no balcão, e o cliente final que agenda pela página pública — ver Anexo A.)*

## 03 · Requisitos Funcionais

- **RF01** — O sistema deve permitir que o dono cadastre a barbearia e sua própria conta em um único passo (`POST /auth/register`).
- **RF02** — O sistema deve autenticar usuários (dono, profissional, recepção) por e-mail e senha, retornando um token JWT (`POST /auth/login`).
- **RF03** — O dono deve poder cadastrar, editar e desativar serviços (nome, duração em minutos, preço).
- **RF04** — O dono ou a recepção deve poder cadastrar e editar clientes (nome, telefone, e-mail opcional).
- **RF05** — O sistema deve permitir criar um agendamento interno com um cliente cadastrado ou uma identificação livre, além de profissional, serviço e horário de início; o horário de fim é calculado pela duração do serviço. Agendamentos públicos continuam solicitando nome e telefone.
- **RF06** — O sistema deve rejeitar a criação ou edição de um agendamento que sobreponha outro agendamento já existente do mesmo profissional.
- **RF07** — O cliente final deve poder consultar os serviços e os horários disponíveis de uma barbearia pela página pública (por `slug`), sem precisar criar conta, e confirmar um agendamento.
- **RF08** — O dono deve poder conectar sua conta do Google (OAuth) para permitir que o sistema leia uma planilha do Google Sheets.
- **RF09** — O sistema deve importar atendimentos históricos a partir de uma planilha conectada, registrando-os como `Atendimento` vinculado a cliente e serviço.
- **RF10** — O sistema deve impedir que um usuário veja ou altere dados (clientes, serviços, agendamentos) de uma barbearia diferente da sua.

## 04 · Requisitos Não Funcionais

- **RNF01** — Nenhuma consulta ao banco pode retornar dados de uma `barbeariaId` diferente da do usuário autenticado (isolamento multi-tenant validado por teste automatizado em 100% dos endpoints autenticados).
- **RNF02** — Senhas devem ser armazenadas com hash `bcrypt` (custo ≥ 10); nunca em texto plano, inclusive em logs.
- **RNF03** — Endpoints autenticados devem responder em até 300ms no percentil 95, sob carga de até 50 requisições/segundo.
- **RNF04** — Dados pessoais de clientes (nome, telefone, e-mail) só podem ser coletados com a finalidade de agendamento, e a barbearia deve poder excluir um cliente e seu histórico mediante solicitação (conformidade com a LGPD).
- **RNF05** — A importação de planilha deve suportar ao menos 2.000 linhas processadas em até 30 segundos, sem travar a API para outras requisições.
- **RNF06** — O token JWT deve expirar em no máximo 7 dias, exigindo novo login após esse período.

## 05 · Histórias de Usuário

**US01 — Must** — Como dono de barbearia, quero cadastrar meus serviços com duração e preço, para montar a agenda corretamente.
- [ ] Consigo criar um serviço informando nome, duração em minutos e preço.
- [ ] O sistema rejeita duração menor que 5 minutos.
- [ ] Um serviço desativado deixa de aparecer nas opções de agendamento (inclusive na página pública).

**US02 — Must** — Como dono de barbearia, quero agendar um horário para um cliente cadastrado ou registrar uma identificação rápida, com um profissional específico, para evitar conflitos de agenda sem exigir cadastro para todo atendimento.
- [ ] O sistema rejeita um agendamento que sobreponha outro do mesmo profissional.
- [ ] O horário de fim é calculado automaticamente a partir da duração do serviço escolhido.
- [ ] O agendamento criado aparece imediatamente na listagem de agendamentos da barbearia.

**US03 — Should** — Como cliente final, quero agendar um horário pela página pública da barbearia sem criar conta, para marcar meu corte rapidamente.
- [ ] Vejo apenas os horários realmente disponíveis do profissional/serviço escolhido.
- [ ] Recebo confirmação do agendamento após enviar meus dados.
- [ ] Não tenho acesso a dados de outros clientes ou agendamentos da barbearia.

**US04 — Could** — Como dono de barbearia, quero importar meus atendimentos antigos de uma planilha do Google Sheets, para não perder o histórico que já tinha.
- [ ] Consigo conectar minha conta Google e escolher a planilha.
- [ ] O sistema mostra quantos atendimentos foram importados com sucesso e quantos falharam.
- [ ] Atendimentos importados ficam vinculados ao cliente e serviço corretos (criando-os se não existirem).

## 06 · Critérios de Aceite (checklist consolidado)

- [ ] Serviço: criação com nome, duração ≥ 5min e preço; desativação remove da listagem pública.
- [ ] Agendamento: sem overlap por profissional; fim calculado pela duração; aparece na listagem imediatamente.
- [ ] Página pública: lista apenas horários livres; confirma agendamento; não vaza dados de terceiros.
- [ ] Importação: relatório de sucesso/falha por linha; vínculo correto a cliente e serviço.
- [ ] Isolamento multi-tenant: nenhuma resposta de API contém dado de outra `barbeariaId`.

## 07 · Fora de Escopo (não entra no MVP)

- Cobrança/pagamento online do cliente final (pagamento continua sendo combinado presencialmente).
- Aplicativo mobile nativo (fica web/PWA).
- Lista de espera automática para horários lotados.
- Programa de fidelidade ou pontos.
- Sincronização de escrita com o Google Calendar (hoje o Google é usado só para leitura de planilhas).
- Múltiplos idiomas.

---

## Anexo A · Personas consideradas

1. **Marcos — dono da barbearia** *(persona primária, justificativa: é quem decide contratar o SaaS e quem sente a dor de forma mais direta e recorrente)*.
2. **Juliana — recepcionista/gerente**, opera o sistema no balcão para múltiplos profissionais; dor parecida com a de Marcos mas sem poder de decisão de compra.
3. **Cliente final (sem conta)**, só interage pela página pública; dor é não conseguir marcar horário fora do expediente da barbearia por WhatsApp.

## Anexo B · Entrevista simulada (estrutura CTQF, ~10 min)

**Contexto**: entrevista aberta simulada com a persona Marcos (dono de barbearia), feita para levantar dores antes de escrever os requisitos.
**Tarefa**: entender como a agenda é gerenciada hoje e onde ela falha.
**Questões e respostas**:

- *Como você organiza a agenda hoje?* — "Por WhatsApp mesmo, o cliente manda mensagem e eu ou minha esposa respondemos quando dá."
- *Já aconteceu de marcar dois clientes no mesmo horário?* — "Toda semana. Principalmente quando os dois profissionais recebem mensagem ao mesmo tempo e ninguém olha a agenda do outro."
- *Você tem algum controle de quanto cada serviço rendeu?* — "Tenho uma planilha velha que uso de vez em quando, mas fica desatualizada."
- *Se o cliente quiser marcar às 23h de domingo, o que acontece?* — "Ele manda mensagem e só vejo segunda de manhã, muitas vezes já perdi o cliente pra outra barbearia."
- *O que faria você confiar em um sistema novo?* — "Se for simples de usar no celular e não me obrigar a ficar copiando tudo que já tenho."
**Formato da saída**: as respostas acima foram usadas diretamente para derivar a persona (seção 02) e os RF05–RF07 (agendamento sem conflito e página pública).

---

## Checklist de validação humana

> Preencher manualmente antes de considerar o documento aprovado.

- [ ] **Cruzamento** — cada RF tem persona associada? Cada RNF é mensurável? *(RF05–RF07 e RF09 mapeiam diretamente para falas da entrevista de Marcos; RNFs 01, 03 e 05 têm número e unidade de medida.)*
- [ ] **Viés** — a IA inventou APIs, bibliotecas ou padrões inexistentes? *(Todos os RFs foram conferidos contra os controllers reais em `backend/src/*/\*.controller.ts` antes de escrever este documento — nenhuma feature listada aqui é fictícia.)*
- [ ] **Clareza** — um dev novo consegue ler e entender em 5 minutos?
- [ ] **Segurança** — os RNFs cobrem autenticação, dados sensíveis e LGPD? *(RNF02 cobre hash de senha, RNF01 cobre isolamento multi-tenant, RNF04 cobre LGPD.)*
