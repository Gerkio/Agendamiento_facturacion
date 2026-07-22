-- ============================================================
-- Migración 031 — Emisión atómica de recibos de caja
-- Reemplaza el flujo cliente de 2 pasos (insertar cabecera + insertar abonos en
-- round-trips separados) por una sola transacción en el servidor. Elimina:
--   - recibos huérfanos (cabecera sin líneas si el navegador muere en medio),
--   - que el total del recibo lo fije el cliente (aquí se calcula como suma de
--     las líneas, autoridad del servidor),
--   - abonar una factura de OTRO cliente (se valida pertenencia + validada DIAN).
-- El trigger check_payment_within_balance (030) sigue imponiendo abono<=saldo por
-- factura, ahora dentro de la misma transacción. SECURITY INVOKER → la RLS admin
-- de payment_receipts / invoice_payments aplica igual que en el insert directo.
-- ============================================================

CREATE OR REPLACE FUNCTION emit_payment_receipt(
  p_client_id UUID,
  p_issue_date DATE,
  p_method TEXT,
  p_note TEXT,
  p_items JSONB  -- [{ "invoice_id": "uuid", "amount": number }, ...]
)
RETURNS payment_receipts
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_receipt payment_receipts;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_invoice_id UUID;
  v_amount NUMERIC;
  v_date DATE := COALESCE(p_issue_date, current_date);
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El recibo no tiene abonos.';
  END IF;

  -- 1) Validar cada línea y sumar el total (autoridad del servidor).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_invoice_id := (v_item->>'invoice_id')::uuid;
    v_amount := (v_item->>'amount')::numeric;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Monto de abono inválido en el recibo.';
    END IF;
    PERFORM 1 FROM invoices
      WHERE id = v_invoice_id AND client_id = p_client_id AND billing_status = 'sent_dian';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La factura % no pertenece al cliente o no está validada por la DIAN.', v_invoice_id;
    END IF;
    v_total := v_total + v_amount;
  END LOOP;

  -- 2) Cabecera (el trigger asigna receipt_number; total = suma de líneas).
  INSERT INTO payment_receipts (client_id, issue_date, total_amount, method, note, created_by)
    VALUES (p_client_id, v_date, v_total, p_method, p_note, auth.uid())
    RETURNING * INTO v_receipt;

  -- 3) Líneas: check_payment_within_balance (030) valida abono<=saldo por factura
  --    con FOR UPDATE, dentro de esta misma transacción → todo o nada.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO invoice_payments (invoice_id, amount, paid_at, method, note, receipt_id, created_by)
      VALUES (
        (v_item->>'invoice_id')::uuid,
        (v_item->>'amount')::numeric,
        v_date, p_method, p_note, v_receipt.id, auth.uid()
      );
  END LOOP;

  RETURN v_receipt;
END;
$$;

REVOKE EXECUTE ON FUNCTION emit_payment_receipt(UUID, DATE, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION emit_payment_receipt(UUID, DATE, TEXT, TEXT, JSONB) TO authenticated;
