-- Pareamento painel TV / app Android: código gerado no app; operador confirma no painel web.

CREATE TABLE IF NOT EXISTS tv_pairing_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sessao_id uuid REFERENCES sessoes(id) ON DELETE CASCADE,
  code varchar(6) NOT NULL,
  camera_label varchar(120),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  pending_plain_token varchar(200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tv_pairing_codes_tenant_code_idx ON tv_pairing_codes (tenant_id, code);

CREATE TABLE IF NOT EXISTS tv_display_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sessao_id uuid NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  camera_label varchar(120),
  last_poll_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tv_display_devices_token_hash_idx ON tv_display_devices (token_hash);
