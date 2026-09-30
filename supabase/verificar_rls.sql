-- =============================================================================
-- Verificación de RLS (solo lectura, no modifica nada)
-- Ejecutar en: Dashboard de Supabase > SQL Editor
-- Resultado esperado: rls_activo = true en TODAS las filas.
-- =============================================================================

-- 1) Tablas de public: ¿tienen RLS activo?
select c.relname as tabla, c.relrowsecurity as rls_activo
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
order by c.relname;

-- 2) storage.objects: ¿tiene RLS activo?
select 'storage.objects' as tabla, relrowsecurity as rls_activo
from pg_class
where oid = 'storage.objects'::regclass;

-- 3) Políticas vigentes (para contrastar con docs/base-de-datos.md)
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, cmd;

-- 4) Si alguna tabla devolviera rls_activo = false, activarlo con:
--    alter table public.<tabla> enable row level security;
--    (con las políticas actuales no cambia nada de lo que la app usa)
