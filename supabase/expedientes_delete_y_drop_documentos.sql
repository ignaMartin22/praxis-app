-- =============================================================================
-- DELETE en expedientes + baja de la tabla obsoleta `documentos`
-- Aplicada el 2026-09-30 en: Dashboard de Supabase > SQL Editor
-- Requiere: public.is_tenant_owner() (definida en expediente_pdfs.sql)
-- =============================================================================
-- Verificación previa (FK hacia expedientes): plazos, expediente_pdfs y
-- documentos tenían ON DELETE CASCADE, por lo que no se modificó ninguna FK.
-- Nota: el borrado en cascada elimina las filas de expediente_pdfs pero NO los
-- objetos del bucket 'expediente-pdfs'; la app debe borrarlos antes.

begin;

-- 1) DELETE en expedientes: solo el dueño del tenant
drop policy if exists "expedientes_delete_own_tenant" on public.expedientes;
create policy "expedientes_delete_own_tenant"
on public.expedientes
for delete
to authenticated
using (public.is_tenant_owner(tenant_id));

-- 2) Eliminar documentos (aborta si tuviera filas)
do $$
begin
  if exists (select 1 from public.documentos) then
    raise exception 'documentos no está vacía; migración abortada.';
  end if;
end $$;

drop table public.documentos;  -- sus políticas se eliminan junto con la tabla

commit;
