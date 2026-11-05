# Manual do Usuário — SysLegis

Guia simples de como usar o sistema SysLegis, a plataforma de gestão legislativa da Câmara Municipal. Este manual não usa termos técnicos de programação — é voltado para quem vai usar o sistema no dia a dia (vereadores, secretaria, operadores de painel, jurídico, recepção, etc).

---

## 1. Como entrar no sistema

![Tela de Login](docs/manual/00-login.jpg)

Acesse o endereço da plataforma no navegador. Na tela de **Login**, informe:

- **E-mail ou Usuário** — pode digitar o e-mail completo ou apenas o nome de usuário cadastrado.
- **Senha**.

Clique em **Entrar no Sistema**. Se os dados estiverem errados, uma mensagem em vermelho vai avisar.

> Depois de entrar, você é levado automaticamente para a tela inicial adequada ao seu perfil. Contas que só cuidam de transmissão ao vivo, por exemplo, caem direto na tela de **OBS** em vez do Dashboard.

### Primeiro acesso da Câmara (uma única vez)
Se a instalação é totalmente nova, existe uma página inicial de configuração que cria o primeiro usuário **Administrador Master** (com um e-mail e senha de exemplo). **Assim que entrar pela primeira vez, troque essa senha padrão em Configurações/Usuários** — deixá-la como está é um risco de segurança.

---

## 2. Conhecendo a tela principal (Dashboard)

Depois do login, você cai na tela **Dashboard** (Início). O conteúdo muda de acordo com quem está logado:

- **Administração/Secretaria**: vê números gerais — total de vereadores, setores, visitantes/oradores cadastrados e usuários ativos.
- **Vereador**: vê um resumo pessoal — suas proposições, comissões das quais participa, itens de pauta e convites de coautoria pendentes.

![Dashboard do SysLegis](docs/manual/01-dashboard.jpg)

No topo, o **menu lateral (sidebar)** é o ponto de partida para tudo. Ele é dividido em quatro grupos, e os itens que aparecem para você dependem das permissões do seu setor/cargo:

| Grupo | O que você encontra |
|---|---|
| **Início** | Dashboard, OBS (transmissão) |
| **Processo Legislativo** | Sessões, Tramitação, Pautas da Sessão, Proposições, Painel TV/Operador/Presidente/Vereador |
| **Institucional** | Bancadas, Vereadores, Comissões, Oradores |
| **Administração** | Setores, Usuários, Configurações |

---

## 3. Proposições (Projetos de Lei, Indicações, Moções...)

![Tela de Proposições](docs/manual/02-proposicoes.jpg)

É onde ficam cadastradas todas as matérias legislativas. Você pode buscar, filtrar por status (**Protocolado, Tramitando, Pauta, Aprovado, Rejeitado**) e, quando já houve votação, o placar (Sim/Não/Abstenção) aparece direto no card.

### Criando uma proposição
1. Clique em **Nova Proposição**.
2. Escolha o **tipo de matéria** (Projeto de Lei, Indicação, Moção, Requerimento, etc.).
3. Defina a **autoria**: você mesmo, a Mesa Diretora (só para o Presidente) ou o Poder Executivo. É possível adicionar **coautores**.
4. Para o texto do projeto, você tem duas opções:
   - **Enviar um arquivo pronto** (PDF ou DOCX).
   - **Usar o Editor com a SysLegisIA** (assistente de inteligência artificial):
     - **Gerar esboço**: digite o tema (ex: "projeto de lei sobre reciclagem") e a IA escreve a ementa e o texto completo já formatado no padrão jurídico-legislativo.
     - **Refinar texto**: se você já escreveu algo, a IA deixa o texto mais formal e técnico, mantendo a estrutura de artigos.
5. Salve. O sistema gera automaticamente um **PDF oficial timbrado** para download.

> Se aparecer um aviso de que a IA não está disponível, é porque a chave de acesso à IA não foi configurada — isso se resolve na tela **Configurações** (veja a seção 9).

---

## 4. Tramitação (análise jurídica e de comissões)

![Tela de Tramitação](docs/manual/04-tramitacao.jpg)

Tela usada pelo setor Jurídico, pelas Comissões e pela Administração para dar andamento às proposições antes de irem à votação.

- Do lado esquerdo, a lista de proposições em análise; do lado direito, o histórico e os pareceres já registrados.
- **Registrar parecer**: escolhe o tipo (Jurídico ou de Comissão), a conclusão (Favorável, Contrário ou Com ressalvas) e o texto do parecer.
- A Administração pode **definir para qual comissão** a matéria segue, ou encaminhá-la **direto para a pauta**.
- Há um espaço de **Notas** (uma espécie de chat interno) para conversar sobre a proposição com quem está envolvido na tramitação.
- Botão **Ler Projeto** abre o PDF oficial na tela.

Fluxo normal: **Jurídico dá parecer → Administração escolhe a comissão → Comissão dá parecer → matéria vai para a pauta.**

---

## 5. Pautas da Sessão (montar a Ordem do Dia)

![Tela de Gestão de Pautas](docs/manual/05-pautas.jpg)

Depois que uma proposição está "pronta para pauta", ela precisa ser incluída na sessão em que será discutida/votada.

1. Escolha a sessão.
2. Na coluna da esquerda ficam as proposições liberadas; clique no **"+"** para colocá-las na Ordem do Dia (coluna da direita).
3. Também é possível fazer uma **inserção manual** (comunicados, leituras, ofícios) sem passar pela tramitação normal — só título, tipo e autoria, com opção de anexar um arquivo.

---

## 6. Sessões plenárias

![Tela de Sessões Plenárias](docs/manual/03-sessoes.jpg)

Mostra a agenda e o histórico das reuniões, com data, tipo (Ordinária, Extraordinária, Solene, Audiência Pública), status e resultado da votação.

- **Iniciar Sessão agora** — cria e abre uma sessão na hora.
- **Agendar Sessão** — marca uma sessão futura (tipo, número, data/hora).
- Cada sessão tem botões de **Editar**, **Excluir** e um botão que alterna entre **Abrir → Encerrar → Reabrir**.

---

## 7. A votação ao vivo (painéis em tempo real)

Este é o coração do sistema durante uma sessão. Existem quatro telas diferentes, cada uma para uma pessoa/função, e elas ficam sincronizadas entre si em tempo real:

### 🖥️ Painel do Operador
![Painel do Operador](docs/manual/07-painel-operador.jpg)

Usado pela equipe técnica que conduz a sessão. Nele dá para:
- Abrir/encerrar/reiniciar a votação da matéria da vez;
- Avançar para o próximo item da Ordem do Dia;
- Marcar a **presença** de cada vereador (presencial ou remota);
- Gerenciar a fila de pedidos de palavra (discurso, aparte, questão de ordem) de vereadores e também de **oradores externos** (visitantes);
- Controlar o **cronômetro** de quem está falando (iniciar, parar, somar/tirar minutos).

### 🏛️ Painel do Presidente
![Painel do Presidente](docs/manual/08-painel-presidente.jpg)

Usado por quem preside a sessão. Mostra a matéria em discussão/votação, permite avançar a pauta, **iniciar a votação** e, em caso de empate, aplicar o **voto minerva** (voto de desempate). Como o Presidente também é vereador, ele vota e pede a palavra normalmente pela mesma tela.

### 📺 Painel TV
![Painel TV](docs/manual/06-painel-tv.jpg)

É a tela pensada para ser exibida no telão do plenário ou na transmissão ao vivo. Mostra a matéria em votação, o placar geral e um mural com a foto de cada vereador, destacando visualmente o voto (verde = sim, vermelho = não, âmbar = abstenção) e quem está presente. Quando alguém está com a palavra, aparece a foto e o cronômetro em tela cheia.

### 🙋 Painel do Vereador
![Painel do Vereador — check-in de presença](docs/manual/09-painel-vereador.jpg)

Cada parlamentar usa no próprio celular/tablet:
1. Primeiro faz o **check-in de presença** (presencial ou remoto);
2. Enquanto não há votação, pode pedir a palavra, aparte ou questão de ordem;
3. Quando a votação abre, aparecem três botões grandes: **Votar a Favor**, **Votar Contra** ou **Abster-se** — com uma confirmação antes de registrar o voto definitivamente.

**Resumindo a dinâmica:** o Operador (ou o Presidente) avança a pauta e abre a votação → cada vereador vota no seu próprio painel → o resultado aparece ao vivo no Painel TV para todos verem.

---

## 8. Cadastros institucionais

### Bancadas
![Tela de Bancadas](docs/manual/10-bancadas.jpg)

Cadastro dos partidos/legendas representados na Câmara: nome, sigla e logo. Mostra quantos vereadores cada bancada tem.

### Vereadores
![Tela de Vereadores](docs/manual/11-vereadores.jpg)

Cadastro dos parlamentares: nome, foto, bancada, situação do mandato (Ativo/Inativo), cargo na Mesa (Presidente, Vice, 1º/2º Secretário) e criação do login de acesso (usuário e senha).

### Comissões
![Tela de Comissões](docs/manual/12-comissoes.jpg)

Cadastro das comissões permanentes/temporárias: nome, sigla, Presidente da comissão, Relator e demais membros.

### Oradores (Visitantes)
![Tela de Oradores/Visitantes](docs/manual/13-oradores.jpg)

Cadastro de pessoas que não são vereadores mas podem usar a palavra na tribuna (representantes da comunidade, autoridades convidadas, etc.): nome, foto, representação/cargo, assunto da fala e a opção **"Disponível na Tribuna"**, que faz o nome aparecer na fila de pedidos de palavra do Painel do Operador.

> Observação: o cadastro de foto é feito enviando um arquivo de imagem. Em celulares, o seletor de arquivo pode abrir a câmera do próprio aparelho — mas isso é um recurso do celular, não uma câmera embutida na tela do sistema.

---

## 9. Administração do sistema

Estas telas normalmente são usadas apenas por quem administra o sistema na Câmara.

### Setores
![Tela de Setores](docs/manual/14-setores.jpg)

Define os **departamentos** (Secretaria, Gabinete, TI, Jurídico, Operador, etc.) e, para cada um, **quais telas do menu ele pode acessar** — é assim que o sistema controla quem vê o quê. Setores "de sistema" (como Operador e Jurídico) não podem ser excluídos, só editados.

### Usuários
![Tela de Usuários](docs/manual/15-usuarios.jpg)

Cadastro de contas para servidores e assessores (quem não é vereador): nome, usuário de login, senha, setor (que define as permissões) e status Ativo/Inativo.

### Configurações
![Tela de Configurações](docs/manual/16-configuracoes.jpg)

Central de ajustes da instituição:
- **Identidade Institucional**: nome da Câmara e brasão (logo).
- **Timbre de Documentos**: título/subtítulo que aparecem no cabeçalho dos PDFs oficiais gerados.
- **Numeração de Proposições**: define o próximo número de protocolo por ano e tipo de matéria.
- **Regras de Oratória**: tempo padrão do cronômetro de discurso e de aparte usado nos painéis.
- **Inteligência Artificial (SysLegisIA)**: campo onde se cadastra a chave de acesso à IA (Google Gemini), necessária para os recursos de geração e refino de texto em Proposições.

---

## 10. OBS (transmissão ao vivo)

![Tela de Overlays OBS](docs/manual/17-obs.jpg)

Tela voltada para quem opera a transmissão da sessão pelo programa OBS Studio. Não é um cadastro — é uma central de links prontos para colar como "Fonte de navegador" no OBS:

- **Overlay de Oratória**: mostra, em uma faixa na parte de baixo do vídeo, o nome, foto e cargo de quem está falando, com o cronômetro.
- **Overlay de Brasão**: exibe o brasão da Câmara fixo no canto da transmissão.

Basta escolher a sessão, clicar em **Copiar URL** e colar no OBS.

---

## Dicas gerais

- Cada pessoa só vê no menu lateral as telas permitidas para o seu setor — se algo estiver faltando, fale com a Administração para revisar as permissões em **Setores**.
- Vereadores só enxergam e editam as próprias proposições (exceto matérias da Mesa Diretora).
- Sempre confira o resultado da votação e o PDF gerado antes de considerar uma proposição encerrada.
- Troque senhas padrão/de exemplo assim que possível.
