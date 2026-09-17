-- =============================================================================
-- PDFs por expediente (máximo 5) — aislamiento por tenant
-- Ejecutar en: Dashboard de Supabase > SQL Editor
-- =============================================================================

-- 1) Helpers de tenancy (securidad defininida: no dependen de RLS)
--    get_tenant_id: devuelve el tenant del usuario autenticado.
--    is_tenant_owner: true si `tenant_id` pertenece al usuario autenticado.
create or replace function public.get_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.tenants t
  where t.owner_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_tenant_owner(tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = tenant_id
      and t.owner_user_id = auth.uid()
  );
$$;

-- 2) Bucket privado de Storage para los PDFs
insert into storage.buckets (id, name, public)
values ('expediente-pdfs', 'expediente-pdfs', false)
on conflict (id) do nothing;

-- 3) Tabla de metadata (los bytes viven en Storage, acá solo ~200 bytes/fila)
create table if not exists public.expediente_pdfs (
  id              uuid primary key default gen_random_uuid(),
  expediente_id   uuid not null references public.expedientes(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  storage_path    text not null unique,       -- {tenant_id}/{expediente_id}/{uuid}.{ext}
  nombre_original text not null,
  tipo_documento  text not null default 'pdf'
                  check (tipo_documento in ('pdf', 'docx', 'jpg', 'png')),
  tamano_bytes    integer not null default 0,
  creado_el       timestamptz not null default now()
);

-- Para bases ya creadas con el script anterior: agrega la columna si falta.
alter table public.expediente_pdfs
  add column if not exists tipo_documento text not null default 'pdf'
  check (tipo_documento in ('pdf', 'docx', 'jpg', 'png'));

create index if not exists expediente_pdfs_expediente_id_idx on public.expediente_pdfs (expediente_id);
create index if not exists expediente_pdfs_tenant_id_idx on public.expediente_pdfs (tenant_id);

alter table public.expediente_pdfs enable row level security;

-- 4) RLS de la tabla: cada tenant SOLO ve/inserta/borra sus propios PDFs
drop policy if exists "expediente_pdfs_select_own_tenant" on public.expediente_pdfs;
create policy "expediente_pdfs_select_own_tenant"
on public.expediente_pdfs
for select
to authenticated
using (public.is_tenant_owner(tenant_id));

-- El INSERT valida dos cosas: (a) el tenant es del usuario, y
-- (b) el expediente al que se adjunta pertenece al MISMO tenant.
drop policy if exists "expediente_pdfs_insert_own_tenant" on public.expediente_pdfs;
create policy "expediente_pdfs_insert_own_tenant"
on public.expediente_pdfs
for insert
to authenticated
with check (
  public.is_tenant_owner(tenant_id)
  and public.is_tenant_owner(
    (select expedientes.tenant_id from public.expedientes where expedientes.id = expediente_id)
  )
);

drop policy if exists "expediente_pdfs_delete_own_tenant" on public.expediente_pdfs;
create policy "expediente_pdfs_delete_own_tenant"
on public.expediente_pdfs
for delete
to authenticated
using (public.is_tenant_owner(tenant_id));

-- 5) RLS de Storage para el bucket expediente-pdfs
--    Las rutas SON {tenant_id}/... — la primer carpeta debe ser el tenant del usuario.
drop policy if exists "expediente_pdfs_storage_insert" on storage.objects;
create policy "expediente_pdfs_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'expediente-pdfs'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = public.get_tenant_id()::text
);

drop policy if exists "expediente_pdfs_storage_select" on storage.objects;
create policy "expediente_pdfs_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expediente-pdfs'
  and (storage.foldername(name))[1] = public.get_tenant_id()::text
);

drop policy if exists "expediente_pdfs_storage_delete" on storage.objects;
create policy "expediente_pdfs_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'expediente-pdfs'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = public.get_tenant_id()::text
);

-- 6) Límite de 5 PDFs por expediente (defensa en servidor)
--    Opcional con mucha concurrencia: para garantía absoluta ante pedidos
--    simultáneos habría que usar una edge function; este trigger cubre el caso normal.
create or replace function public.expediente_pdfs_check_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  cnt integer;
begin
  select count(*) into cnt
  from public.expediente_pdfs
  where expediente_id = new.expediente_id
    and tenant_id = new.tenant_id;

  if cnt >= 5 then
    raise exception 'El expediente ya tiene 5 PDFs (límite alcanzado).';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_expediente_pdfs_limit on public.expediente_pdfs;
create trigger trg_expediente_pdfs_limit
before insert on public.expediente_pdfs
for each row
execute function public.expediente_pdfs_check_limit();

-- 7) (Opcional) Verificación rápida de configuración
--    select public.get_tenant_id();
--    select * from public.expediente_pdfs;