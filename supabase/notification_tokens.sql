-- =============================================================================
-- Tokens de notificación push por tenant (RF-24)
-- Ejecutar en: Dashboard de Supabase > SQL Editor
-- Requiere primero: supabase/expediente_pdfs.sql (helpers get_tenant_id / is_tenant_owner)
-- =============================================================================

-- 1) Tabla de tokens (los empuja la app vía RLS en su propio tenant)
create table if not exists public.notification_tokens (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  device_token text not null,
  platform     text not null check (platform in ('android', 'ios')),
  creado_el    timestamptz not null default now(),
  unique (tenant_id, device_token)
);

create index if not exists notification_tokens_tenant_id_idx on public.notification_tokens (tenant_id);

alter table public.notification_tokens enable row level security;

-- 2) RLS: cada tenant SOLO administra sus propios tokens (sin UPDATE; solo existe/nace).
--    La edge function push-vencimientos usa el service role y NO depende de estas políticas.
drop policy if exists "notification_tokens_select_own_tenant" on public.notification_tokens;
create policy "notification_tokens_select_own_tenant"
on public.notification_tokens
for select
to authenticated
using (public.is_tenant_owner(tenant_id));

drop policy if exists "notification_tokens_insert_own_tenant" on public.notification_tokens;
create policy "notification_tokens_insert_own_tenant"
on public.notification_tokens
for insert
to authenticated
with check (public.is_tenant_owner(tenant_id));

drop policy if exists "notification_tokens_delete_own_tenant" on public.notification_tokens;
create policy "notification_tokens_delete_own_tenant"
on public.notification_tokens
for delete
to authenticated
using (public.is_tenant_owner(tenant_id));

-- 3) (Opcional) Verificación rápida de configuración
--    select * from public.notification_tokens;