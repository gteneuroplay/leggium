# SysLegis

Sistema de gestão legislativa municipal, com suporte a múltiplas câmaras e personalização por instalação.

## Preparação

1. Instale Node.js e Docker.
2. Copie `deploy/env.docker.example` para `deploy/env.docker`.
3. Defina valores exclusivos para banco de dados, autenticação e acesso ao pgAdmin.
4. Inicie com `docker compose --env-file deploy/env.docker up -d --build`.
5. Consulte `deploy/INSTRUCOES.txt` e `MANUAL_USUARIO.md` para configuração e uso.

O pacote não inclui banco de dados, uploads, dependências instaladas ou credenciais de instalação.
