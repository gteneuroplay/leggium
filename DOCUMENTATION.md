# Documentação de Desenvolvimento - SysLegis 🏛️

Este documento descreve os padrões técnicos, a arquitetura e as decisões de design adotadas no desenvolvimento da plataforma **SysLegis**.

---

## 🚀 Stack Tecnológica

*   **Framework**: Next.js 16 (App Router + Turbopack).
*   **Banco de Dados**: PostgreSQL (instância própria, ex.: VPS).
*   **ORM**: Prisma (para modelagem e gestão de esquemas).
*   **Estilização**: Tailwind CSS com componentes customizados (Vanilla CSS para efeitos premium).
*   **Autenticação**: Sessão na aplicação (cookie + JWT legível no servidor) com tabela `users` no Postgres.
*   **Realtime (painel)**: Eventos em memória no processo Node (`EventEmitter`) + SSE/polling nas rotas do Next.js — sem dependência de serviço externo de realtime.

---

## 🏗️ Arquitetura de Pastas

*   `src/app/`: Rotas do sistema, divididas por módulos funcionais.
    *   `actions.ts`: Server Actions para manipulação de dados (padrão de segurança do Next.js).
    *   `[modulo]Client.tsx`: Componentes de interface do lado do cliente (Interatividade).
*   `src/components/`:
    *   `layout/`: Estrutura global (Sidebar, Header, AppLayout).
    *   `ui/`: Componentes reutilizáveis de alta fidelidade (Modais, Uploads).
*   `src/lib/`: Utilitários, DAL (Data Access Layer), auth, tenant, realtime em processo, etc.
*   `db/migrations/`: Scripts SQL versionados para aplicar manualmente (ou por pipeline) no PostgreSQL da VPS.

---

## 🔐 Sistema de Permissões (RBAC Dinâmico)

Diferente de sistemas estáticos, o SysLegis utiliza um modelo de **Permissões baseadas em Setores**:
1.  **Setores**: Cada setor (ex: Secretaria, Gabinete, TI) possui uma lista de "Abas Permitidas".
2.  **Cargos**: Funcionários são vinculados a um setor.
3.  **Middleware**: O sistema valida em tempo real se o usuário tem acesso à rota que está tentando acessar baseado nas permissões do seu setor.
4.  **Admin Master/DEV**: Níveis de acesso que ignoram restrições para manutenção do sistema.

---

## 📺 Painel Legislativo & Motor de Votação (Realtime)

O módulo de plenário é uma aplicação reativa de alta performance, projetada para orquestrar sessões legislativas com sincronização absoluta entre múltiplos perfis:

### 🗳️ Motor de Votação Síncrono
*   **Sincronização entre ecrãs**: Server actions persistem no Postgres e emitem eventos em memória; os clientes do painel atualizam via polling e/ou SSE, mantendo TV, operador e vereadores alinhados.
*   **Ciclo de Vida**: Transição automática entre estados `AGENDADA` -> `ABERTA` -> `EM_VOTACAO` -> `ENCERRADA`.
*   **Cálculo Instantâneo**: Resultados (Sim/Não/Abstenção) processados em tempo real com persistência no banco de dados após o encerramento.

### 🎭 Perfis de Visualização
*   **Painel TV (Broadcasting)**: Focado em legibilidade para o público e parlamentares, exibindo ementas, fotos dos vereadores e placares dinâmicos com animações de entrada.
*   **Painel Operador (Control Center)**: Interface crítica para gestão da **Ordem do Dia**, abertura de votações, controle de presença e cronômetros de oradores.
*   **Painel Presidente (Supervisão)**: Monitor de alta fidelidade para a mesa diretora, permitindo visualizar votos individuais e gerir a pauta.
*   **Painel Vereador (Terminal de Voto)**: Interface otimizada para dispositivos móveis/tablets, focada no ato de votar com feedback visual imediato.

### 📅 Ordem do Dia & Presença
*   **Gestão de Pauta**: Lista sequencial de proposições carregada dinamicamente, permitindo ao operador selecionar o próximo item a ser debatido/votado.
*   **Quórum em Tempo Real**: Registro de presenças (Presencial/Remoto) que atualiza instantaneamente o placar de quórum na TV e nos terminais de controle.

---

## ✨ Padrões de Design & UX

*   **Aesthetics**: Uso de *Glassmorphism* (efeitos de vidro/transparência) e sombras profundas para um visual moderno e "vendeável".
*   **Custom Scrollbars**: Barras de rolagem personalizadas em todo o sistema para manter a identidade visual mesmo em áreas de overflow.
*   **Modais Premium**: Modais centralizados, com transições suaves e largura otimizada (`max-w-2xl`) para formulários complexos.

---

## 🤖 SysLegisIA (Inteligência Artificial)

O sistema conta com um assistente legislativo de vanguarda, operando sob a marca **SysLegisIA**.

### 🚀 Infraestrutura de Modelos (v2026 - Geração 3 Preview)
A IA utiliza o **SDK Oficial (@google/generative-ai)** operando com os modelos de vanguarda (atualmente em modo Preview):
- **Gemini 3.1 Pro Preview**: Inteligência máxima para redação técnica complexa e análise de mérito (Modelo de Elite).
- **Gemini 3.0 Pro Preview**: Estabilidade garantida para processos legislativos críticos (Fallback de Performance).
- **Gemini 3.0 Flash Preview**: Velocidade extrema para esboços iniciais e refino de texto.
- **Gemini 3.1 Flash Lite Preview**: Camada de resiliência ultra-rápida.

### 🔄 Fluxo de Trabalho Inteligente
O processo de criação de proposições foi redesenhado para ser sequencial e indutivo:
1.  **Bloqueio de Contexto**: A SysLegisIA só é habilitada após a seleção do **Tipo de Matéria**, garantindo precisão técnica.
2.  **Injeção Automática**: A IA recebe o nome do **Autor**, **Coautores** e a **Data** do sistema.
3.  **Fecho Legislativo**: Gera automaticamente o local, data por extenso e lista de signatários formatada no final do texto.

### 🤝 Gestão de Coautoria
- **Sincronização**: Persistência automática de coautores na tabela `proposicao_colaboradores` ao salvar.
- **Assinaturas**: Sistema preparado para gestão de assinaturas conjuntas digitais.

### 🏛️ Padronização e Equidade Parlamentar
A infraestrutura da **SysLegisIA** é aplicada de forma **unificada para todos os vereadores** da Câmara:
- **Equidade Técnica**: Todos os gabinetes utilizam a mesma cascata de modelos de elite (Geração 3 Preview), garantindo que cada proposição tenha o mesmo rigor jurídico e formal.
- **Configuração Centralizada**: A gestão das chaves API e limites de processamento é feita pelo Tenant (Câmara), assegurando continuidade do serviço para todo o corpo legislativo sem distinção.

---

## 🔄 Fluxo de Trabalho Git

*   **Branches**: Desenvolvimento focado na branch `main` com commits granulares.
*   **Commits**: Mensagens seguindo o padrão *Conventional Commits* (`feat:`, `fix:`, `chore:`, `style:`).
*   **Conexão**: Uso de túnel **SSH** para sincronização segura com o GitHub.

---
*Atualizado em: 22 de Abril de 2026*
