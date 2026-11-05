-- Instalações que já rodaram a versão anterior de 20260511000000 (sessao_id NOT NULL).

ALTER TABLE tv_pairing_codes ALTER COLUMN sessao_id DROP NOT NULL;
ALTER TABLE tv_pairing_codes ADD COLUMN IF NOT EXISTS pending_plain_token varchar(200);
