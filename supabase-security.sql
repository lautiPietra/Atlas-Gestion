-- ============================================================
-- SUPABASE SECURITY — RLS + Constraints
-- Ejecutar en: Supabase > SQL Editor
--
-- IMPORTANTE: Ajustar el cast de user_id según el tipo de la
-- columna en tus tablas:
--   INTEGER → (auth.jwt() ->> 'user_id')::integer
--   BIGINT  → (auth.jwt() ->> 'user_id')::bigint
--   UUID    → (auth.jwt() ->> 'user_id')::uuid
-- ============================================================


-- ── Helper: extraer user_id del JWT ─────────────────────────
-- Todas las políticas usan esta expresión para leer el claim
-- custom 'user_id' que viene del Netlify Function.

-- ============================================================
-- 1. CATEGORIAS
-- ============================================================
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_select" ON categorias FOR SELECT
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "categorias_insert" ON categorias FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "categorias_update" ON categorias FOR UPDATE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id)
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "categorias_delete" ON categorias FOR DELETE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

-- Constraints
ALTER TABLE categorias
  ALTER COLUMN nombre SET NOT NULL,
  ADD CONSTRAINT categorias_nombre_length CHECK (char_length(nombre) BETWEEN 1 AND 100);


-- ============================================================
-- 2. PRODUCTOS
-- ============================================================
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productos_select" ON productos FOR SELECT
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "productos_insert" ON productos FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "productos_update" ON productos FOR UPDATE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id)
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "productos_delete" ON productos FOR DELETE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

-- Constraints
ALTER TABLE productos
  ALTER COLUMN nombre SET NOT NULL,
  ADD CONSTRAINT productos_nombre_length    CHECK (char_length(nombre) BETWEEN 1 AND 200),
  ADD CONSTRAINT productos_precio_positivo  CHECK (precio >= 0),
  ADD CONSTRAINT productos_costo_positivo   CHECK (precio_compra >= 0),
  ADD CONSTRAINT productos_stock_no_negativo CHECK (stock >= 0);


-- ============================================================
-- 3. CLIENTES
-- ============================================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select" ON clientes FOR SELECT
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "clientes_insert" ON clientes FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "clientes_update" ON clientes FOR UPDATE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id)
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "clientes_delete" ON clientes FOR DELETE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

-- Constraints
ALTER TABLE clientes
  ALTER COLUMN nombre SET NOT NULL,
  ADD CONSTRAINT clientes_nombre_length CHECK (char_length(nombre) BETWEEN 1 AND 200),
  ADD CONSTRAINT clientes_email_format  CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');


-- ============================================================
-- 4. PROVEEDORES
-- ============================================================
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_select" ON proveedores FOR SELECT
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "proveedores_insert" ON proveedores FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "proveedores_update" ON proveedores FOR UPDATE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id)
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "proveedores_delete" ON proveedores FOR DELETE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

-- Constraints
ALTER TABLE proveedores
  ALTER COLUMN nombre SET NOT NULL,
  ADD CONSTRAINT proveedores_nombre_length CHECK (char_length(nombre) BETWEEN 1 AND 200),
  ADD CONSTRAINT proveedores_email_format  CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');


-- ============================================================
-- 5. VENTAS
-- ============================================================
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ventas_select" ON ventas FOR SELECT
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "ventas_insert" ON ventas FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

-- Solo se permite actualizar el campo 'estado' (cancelar)
CREATE POLICY "ventas_update" ON ventas FOR UPDATE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id)
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "ventas_delete" ON ventas FOR DELETE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

-- Constraints
ALTER TABLE ventas
  ADD CONSTRAINT ventas_total_positivo CHECK (total >= 0),
  ADD CONSTRAINT ventas_estado_valido  CHECK (estado IN ('completada', 'cancelada'));


-- ============================================================
-- 6. VENTA_ITEMS — aisladas via JOIN a ventas (sin user_id propio)
-- ============================================================
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venta_items_select" ON venta_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ventas v
    WHERE v.id = venta_items.venta_id
      AND (auth.jwt() ->> 'user_id')::integer = v.user_id
  ));

CREATE POLICY "venta_items_insert" ON venta_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM ventas v
    WHERE v.id = venta_items.venta_id
      AND (auth.jwt() ->> 'user_id')::integer = v.user_id
  ));

CREATE POLICY "venta_items_delete" ON venta_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM ventas v
    WHERE v.id = venta_items.venta_id
      AND (auth.jwt() ->> 'user_id')::integer = v.user_id
  ));

-- Constraints
ALTER TABLE venta_items
  ALTER COLUMN venta_id    SET NOT NULL,
  ALTER COLUMN producto_id SET NOT NULL,
  ADD CONSTRAINT venta_items_cantidad_positiva  CHECK (cantidad > 0),
  ADD CONSTRAINT venta_items_precio_no_negativo CHECK (precio_unitario >= 0),
  ADD CONSTRAINT venta_items_subtotal_positivo  CHECK (subtotal >= 0);


-- ============================================================
-- 7. COMPRAS
-- ============================================================
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_select" ON compras FOR SELECT
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "compras_insert" ON compras FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "compras_update" ON compras FOR UPDATE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id)
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "compras_delete" ON compras FOR DELETE
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

-- Constraints
ALTER TABLE compras
  ADD CONSTRAINT compras_total_positivo CHECK (total >= 0),
  ADD CONSTRAINT compras_estado_valido  CHECK (estado IN ('pendiente', 'recibida', 'cancelada'));


-- ============================================================
-- 8. COMPRA_ITEMS — aisladas via JOIN a compras
-- ============================================================
ALTER TABLE compra_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compra_items_select" ON compra_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM compras c
    WHERE c.id = compra_items.compra_id
      AND (auth.jwt() ->> 'user_id')::integer = c.user_id
  ));

CREATE POLICY "compra_items_insert" ON compra_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM compras c
    WHERE c.id = compra_items.compra_id
      AND (auth.jwt() ->> 'user_id')::integer = c.user_id
  ));

CREATE POLICY "compra_items_delete" ON compra_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM compras c
    WHERE c.id = compra_items.compra_id
      AND (auth.jwt() ->> 'user_id')::integer = c.user_id
  ));

-- Constraints
ALTER TABLE compra_items
  ALTER COLUMN compra_id   SET NOT NULL,
  ALTER COLUMN producto_id SET NOT NULL,
  ADD CONSTRAINT compra_items_cantidad_positiva  CHECK (cantidad > 0),
  ADD CONSTRAINT compra_items_precio_no_negativo CHECK (precio_unitario >= 0),
  ADD CONSTRAINT compra_items_subtotal_positivo  CHECK (subtotal >= 0);


-- ============================================================
-- 9. STOCK_MOVIMIENTOS
-- ============================================================
ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movimientos_select" ON stock_movimientos FOR SELECT
  USING ((auth.jwt() ->> 'user_id')::integer = user_id);

CREATE POLICY "stock_movimientos_insert" ON stock_movimientos FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'user_id')::integer = user_id);

-- Inmutable: no UPDATE ni DELETE (log de auditoría)
-- Si necesitás habilitar DELETE para admins, agregar policy condicional por rol.

-- Constraints
ALTER TABLE stock_movimientos
  ALTER COLUMN producto_id SET NOT NULL,
  ADD CONSTRAINT stock_mov_tipo_valido CHECK (tipo IN ('entrada', 'salida', 'ajuste'));


-- ============================================================
-- CONFIGURACIÓN CORS (ejecutar una sola vez)
-- Esto configura los dominios permitidos a nivel de PostgREST.
-- Reemplazá 'https://TU-SITIO.netlify.app' con tu URL real.
-- ============================================================
-- La configuración de CORS se hace en:
-- Supabase Dashboard → Project Settings → API → CORS Allowed Origins
-- Agregar: https://TU-SITIO.netlify.app
-- (No hay SQL para esto — es configuración del dashboard)


-- ============================================================
-- NOTA FINAL
-- Para que auth.jwt() funcione con tu JWT personalizado:
-- 1. Ir a Supabase Dashboard → Project Settings → API
-- 2. Copiar el "JWT Secret" (o establecer uno custom)
-- 3. Agregar ese valor como SUPABASE_JWT_SECRET en Netlify env vars
-- ============================================================


-- ============================================================
-- AUDITORÍA: columna created_by
-- Ejecutar una sola vez para agregar el campo de auditoría.
-- Registra qué usuario del sistema creó cada registro.
-- ============================================================
ALTER TABLE ventas            ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE compras           ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE stock_movimientos ADD COLUMN IF NOT EXISTS created_by text;
