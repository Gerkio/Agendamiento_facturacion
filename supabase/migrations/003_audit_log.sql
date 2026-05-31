-- ============================================================
-- Migración 003 — Registro de auditoría (trazabilidad DIAN)
-- Directriz #6: usuario, fecha/hora UTC, acción, resultado, hash documental.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,                       -- auth.users.id (puede ser null en procesos del sistema)
    user_email TEXT,
    action TEXT NOT NULL,               -- p.ej. 'cert_validated', 'invoice_signed', 'dian_sent'
    result TEXT NOT NULL CHECK (result IN ('success', 'warning', 'failure')),
    document_hash TEXT,                 -- SHA-384 del documento (hex). Nunca el documento ni secretos.
    details JSONB,                      -- metadatos NO sensibles (códigos, conteos, motivos)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()  -- siempre en UTC
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden leer la bitácora. Las escrituras se hacen desde el
-- servidor con service_role (omite RLS); ningún cliente puede insertar/alterar.
DROP POLICY IF EXISTS "admin_read_audit" ON audit_log;
CREATE POLICY "admin_read_audit" ON audit_log FOR SELECT USING (get_user_role() = 'admin');

-- El registro de auditoría es inmutable: sin políticas de UPDATE/DELETE para usuarios.
