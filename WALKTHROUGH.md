# Walkthrough - Implementação SysLegis

Este documento descreve as principais funcionalidades implementadas e como elas podem ser testadas.

## 1. Configuração de Vereador e Controle de Acesso (Multi-tenant)

Implementamos uma camada de segurança e personalização para garantir que o sistema atenda às necessidades institucionais de cada Câmara Municipal.

### Principais Implementações:

- **Domínio de E-mail Dinâmico**:
    - O administrador da Câmara pode definir o domínio institucional (ex: `@camara.gov.br`) nas configurações do tenant.
    - Vereadores são criados automaticamente com esse domínio, simplificando a gestão de contas.

- **Gestão Direta de Credenciais**:
    - O fluxo de edição de vereadores persiste e-mail e hash de senha na base (Prisma / Postgres), sem serviço de auth externo.
    - Contas podem ser criadas já utilizáveis conforme a política da câmara.

- **Controle de Acesso Granular (RBAC)**:
    - **Sidebar Filtrada**: Usuários com perfil `VEREADOR` visualizam apenas os menus essenciais: Dashboard, Proposições e Painel Legislativo.
    - **Segurança de Dados**: Vereadores só podem visualizar e editar proposições de sua própria autoria.
    - **Exceção da Mesa Diretora**: O Presidente pode protocolar proposições em nome da **Mesa Diretora**. Todos os membros da mesa ganham visibilidade automática sobre esses projetos institucionais.

- **Sistema de Colaboração (Coautoria)**:
    - Criada infraestrutura para convite e aceite de coautores entre parlamentares, permitindo projetos conjuntos com segurança jurídica.

---

## 2. Cadastro de Visitantes (Painel de Recepção)
O sistema permite o cadastro completo de visitantes, incluindo foto capturada via webcam.

### Fluxo de Teste:
1. Acesse o menu **Visitantes**.
2. Clique em **Novo Visitante**.
3. Preencha os dados e utilize o botão de captura para tirar uma foto.
4. Salve e verifique a listagem com a miniatura da foto.

---

## 3. Gestão de Proposições (IA Legislativa)
Implementamos um assistente de IA que ajuda na redação de projetos de lei e outros documentos.

### Fluxo de Teste:
1. Acesse **Proposições**.
2. Clique em **Nova Proposição**.
3. Use o botão **Assistente de IA**.
4. Descreva o que deseja (ex: "Projeto de lei sobre reciclagem") e clique em **Gerar**.
5. O sistema preencherá automaticamente a ementa e o texto articulado.

---

## 4. Painel de Votação (Legislativo)
O painel em tempo real para controle de sessões.

### Fluxo de Teste:
1. Acesse **Painel Legislativo**.
2. Verifique o quórum em tempo real.
3. Utilize o cronômetro para controlar o tempo de fala dos parlamentares.

---

## 5. Dashboard (Análise de Dados)
Visualização consolidada do tenant atual.

### Fluxo de Teste:
1. Acesse o **Início**.
2. Verifique os gráficos de proposições por tipo e evolução mensal.
3. Note que os dados são filtrados automaticamente pelo tenant do usuário logado.

> [!IMPORTANT]
> A segurança é aplicada em duas camadas: na interface (ocultando menus) e no servidor (validando `autor_id` e `tenant_id` em cada requisição).
