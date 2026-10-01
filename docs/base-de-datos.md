# Base de datos — PraxisApp

Documento de referencia del esquema de Supabase (Postgres + Storage) y de las políticas RLS vigentes.
Fuente: esquema y `pg_policies` exportados del proyecto; `supabase/expediente_pdfs.sql`; uso real en el código (`services/`, `screens/`, `context/`).

> Estado verificado el 2026-09-30 (políticas y RLS) y actualizado el 2026-10-01. Las políticas listadas son las que devolvió `pg_policies`, más la política DELETE de `expedientes`. **RLS está activo en todas las tablas de `public`** (verificado con `supabase/verificar_rls.sql`).

## 1. Modelo de aislamiento

- **Tenant** = un estudio/abogado. Cada usuario de `auth.users` crea su propio tenant al registrarse (`RegisterScreen`).
- Todas las tablas de negocio llevan `tenant_id`. Una fila es visible solo si su tenant pertenece al usuario autenticado (`tenants.owner_user_id = auth.uid()`).
- Hoy hay un solo usuario por tenant (sin roles ni miembros). Compartir expedientes está fuera de alcance del MVP.
- **Clientes no son una entidad**: no existe tabla `clientes`. El cliente es únicamente el texto `expedientes.cliente_apellido`.

## 2. Tablas

### `tenants`
Raíz de propiedad de los datos.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `nombre_estudio` | varchar NOT NULL | |
| `creado_el` | timestamptz | default `now()` |
| `owner_user_id` | uuid | FK → `auth.users(id)` |

Uso en la app: `AuthContext` (lee el tenant del usuario) y `RegisterScreen` (lo crea).

### `expedientes`
Entidad central.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | FK → `tenants(id)` |
| `numero_expediente` | varchar NOT NULL | |
| `caratula` | varchar NOT NULL | |
| `cliente_apellido` | varchar NOT NULL | texto libre, no es entidad |
| `estado` | varchar | default `'En inicio'`. Valores usados: En inicio, En prueba, Para alegar, Sentencia, Archivado. **No hay CHECK**: la validez depende de la app |
| `creado_el` | timestamptz | default `now()` |
| `fecha_vencimiento` | date | nullable |

Archivar = `estado = 'Archivado'`; restaurar = volver a un estado activo (`services/expedientes.ts`).

Borrado definitivo: la política DELETE existe y las FK hijas (`plazos`, `expediente_pdfs`) usan `ON DELETE CASCADE` (verificado con `pg_constraint`, `confdeltype = 'c'`), por lo que borrar un expediente elimina sus plazos y sus filas de archivos. **No elimina los objetos de Storage**: la app debe borrarlos antes (ver Pendientes).

### `expediente_pdfs`
Metadata de los archivos adjuntos de un expediente. Los bytes viven en Storage (bucket `expediente-pdfs`). Pese al nombre, el esquema admite `pdf`, `docx`, `jpg`, `png`; la UI del MVP solo adjunta PDF.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `expediente_id` | uuid NOT NULL | FK → `expedientes(id)` `ON DELETE CASCADE` (verificado en la base) |
| `tenant_id` | uuid NOT NULL | FK → `tenants(id)` |
| `storage_path` | text NOT NULL UNIQUE | `{tenant_id}/{expediente_id}/{uuid}.{ext}` |
| `nombre_original` | text NOT NULL | |
| `tamano_bytes` | integer NOT NULL | default 0 |
| `tipo_documento` | text NOT NULL | CHECK en (`pdf`,`docx`,`jpg`,`png`), default `pdf` |
| `creado_el` | timestamptz NOT NULL | default `now()` |

Regla de negocio: máximo **5 archivos por expediente**, aplicada en la app (`services/expedientePdfs.ts`) y en el servidor con el trigger `trg_expediente_pdfs_limit`.

### `plazos`
Vencimientos procesales de un expediente (con aviso previo).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `expediente_id` | uuid | nullable, FK → `expedientes(id)` `ON DELETE CASCADE` |
| `tenant_id` | uuid NOT NULL | **sin FK** a `tenants` |
| `descripcion` | varchar NOT NULL | |
| `fecha_vencimiento` | timestamptz NOT NULL | |
| `dias_aviso` | integer NOT NULL | default 3 |
| `notificado` | boolean | default false |
| `creado_el` | timestamptz | |

**Sin uso en el código actual.** Está pensada para el disparador de push (RF-24). Hoy el vencimiento que muestra la app es `expedientes.fecha_vencimiento`.

### `notification_tokens`
Tokens de push por dispositivo.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | FK → `tenants(id)` |
| `device_token` | text NOT NULL | sin UNIQUE |
| `platform` | text NOT NULL | CHECK en (`android`,`ios`) |
| `creado_el` | timestamptz NOT NULL | default `now()` |

**Sin uso en el código actual** (las notificaciones push aún no están implementadas en la app).

### `documentos` — eliminada
Tabla de un diseño anterior, reemplazada por `expediente_pdfs`. Se eliminó el 2026-09-30 (vacía y sin uso en el código). Ver [Historial de cambios](#historial-de-cambios). Los textos "documentos" que quedan en la UI y en `docs/` se refieren a los archivos de `expediente_pdfs`.

## 3. Funciones auxiliares

Definidas en `supabase/expediente_pdfs.sql`. Ambas son `STABLE`, `SECURITY DEFINER` y con `search_path = public`, para no depender de RLS al consultar `tenants`.

| Función | Devuelve | Uso |
|---|---|---|
| `get_tenant_id()` | uuid del tenant del usuario autenticado (`owner_user_id = auth.uid()`, `limit 1`) | Políticas de Storage |
| `is_tenant_owner(tenant_id uuid)` | `true` si ese tenant pertenece a `auth.uid()` | Políticas de `expediente_pdfs` y `notification_tokens` |
| `expediente_pdfs_check_limit()` | trigger `BEFORE INSERT` que rechaza el 6.º archivo de un expediente | `expediente_pdfs` |

## 4. Políticas RLS vigentes

Todas permiten acceso únicamente a filas cuyo tenant pertenece a `auth.uid()`. Ninguna usa `true`.

### Tablas `public`

| Tabla | Operación | Política | Rol | Condición |
|---|---|---|---|---|
| `tenants` | SELECT | usuarios ven su propio tenant | public | `owner_user_id = auth.uid()` |
| `tenants` | INSERT | usuarios crean su propio tenant | public | `owner_user_id = auth.uid()` |
| `expedientes` | SELECT | usuarios ven expedientes de su tenant | public | `tenant_id IN (tenants del usuario)` |
| `expedientes` | INSERT | usuarios crean expedientes en su tenant | public | ídem (WITH CHECK) |
| `expedientes` | UPDATE | usuarios actualizan expedientes de su tenant | public | ídem (USING y WITH CHECK) |
| `expedientes` | DELETE | `expedientes_delete_own_tenant` | authenticated | `is_tenant_owner(tenant_id)` |
| `plazos` | SELECT | usuarios ven plazos de su tenant | public | `tenant_id IN (tenants del usuario)` |
| `plazos` | INSERT | usuarios crean plazos en su tenant | public | ídem (WITH CHECK) |
| `expediente_pdfs` | SELECT | `expediente_pdfs_select_own_tenant` | authenticated | `is_tenant_owner(tenant_id)` |
| `expediente_pdfs` | INSERT | `expediente_pdfs_insert_own_tenant` | authenticated | `is_tenant_owner(tenant_id)` **y** el expediente referenciado pertenece al mismo tenant |
| `expediente_pdfs` | DELETE | `expediente_pdfs_delete_own_tenant` | authenticated | `is_tenant_owner(tenant_id)` |
| `notification_tokens` | SELECT / INSERT / DELETE | `notification_tokens_*_own_tenant` | authenticated | `is_tenant_owner(tenant_id)` |

### Storage — bucket `expediente-pdfs` (privado)

Las rutas tienen la forma `{tenant_id}/{expediente_id}/{uuid}.{ext}`; la primera carpeta debe ser el tenant del usuario. Los archivos se abren con URL firmada de 60 s.

| Operación | Política | Condición |
|---|---|---|
| INSERT | `expediente_pdfs_storage_insert` | bucket correcto, `owner = auth.uid()`, primera carpeta = `get_tenant_id()` |
| SELECT | `expediente_pdfs_storage_select` | bucket correcto, primera carpeta = `get_tenant_id()` |
| DELETE | `expediente_pdfs_storage_delete` | bucket correcto, `owner = auth.uid()`, primera carpeta = `get_tenant_id()` |

### Operaciones sin política (por lo tanto denegadas con RLS activo)
`tenants` UPDATE/DELETE · `plazos` UPDATE/DELETE · `expediente_pdfs` UPDATE · `notification_tokens` UPDATE · Storage UPDATE.

## 5. Uso real desde la app

| Tabla / recurso | Dónde se usa |
|---|---|
| `tenants` | `context/AuthContext.tsx`, `screens/RegisterScreen.tsx` |
| `expedientes` | `services/expedientes.ts`, `screens/ExpedienteDetalleScreen.tsx`, `screens/CrearExpedienteScreen.tsx` |
| `expediente_pdfs` + bucket | `services/expedientePdfs.ts` |
| `plazos`, `notification_tokens` | sin uso |

## Pendientes y mejoras recomendadas

Ordenadas por prioridad. Ninguna está aplicada; cualquier cambio en `supabase/` requiere confirmación previa.

3. **Cambiar el rol `public` por `authenticated`** en las políticas de `tenants`, `expedientes` (SELECT/INSERT/UPDATE) y `plazos`, y unificarlas con `is_tenant_owner()`. Hoy funcionan porque `auth.uid()` es NULL para anónimos, pero `authenticated` es más explícito.
4. **Integridad cruzada de `tenant_id`:** nada impide que un hijo tenga un `tenant_id` distinto al de su expediente (solo `expediente_pdfs` lo valida en su política INSERT). Solución: clave única `(id, tenant_id)` en `expedientes` y FK compuesta en las tablas hijas.
5. **Validación de `estado`:** agregar `CHECK` con los cinco valores (el plan lo describe como enum, pero en la base es `varchar`).
6. **`notification_tokens`:** agregar `UNIQUE (device_token)`, una política UPDATE (necesaria para `upsert`) y evaluar atarlo a `user_id`.
7. **`plazos`:** completar FK de `tenant_id`, hacer `expediente_id` obligatorio si no habrá plazos sueltos, y definir si reemplazará a `expedientes.fecha_vencimiento` (hoy hay dos fechas de vencimiento).
8. **Índices:** `expedientes (tenant_id, estado)`, `plazos (expediente_id)`, y un índice parcial `plazos (fecha_vencimiento) WHERE notificado = false` para el job de avisos.
9. **Renombrar `expediente_pdfs`** a `expediente_archivos` si se habilitan otros tipos de archivo.
10. Agregar `UNIQUE (tenant_id, numero_expediente)` si el número no debe repetirse dentro de un estudio.

## Historial de cambios

### 2026-09-30 — DELETE en `expedientes` y baja de `documentos`
Aplicado manualmente en el SQL Editor de Supabase.

- **Nueva política** `expedientes_delete_own_tenant` (`FOR DELETE TO authenticated USING (is_tenant_owner(tenant_id))`). Habilita el borrado definitivo (RF-17) solo para el dueño del tenant.
- **Eliminada la tabla `documentos`** junto con sus dos políticas. Estaba vacía y no se usaba en el código; `expediente_pdfs` la reemplazaba.
- **Verificación previa de FK hacia `expedientes`** (`pg_constraint.confdeltype`): `plazos_expediente_id_fkey`, `expediente_pdfs_expediente_id_fkey` y `documentos_expediente_id_fkey` eran todas `c` (`ON DELETE CASCADE`), por lo que no hizo falta modificar ninguna FK.

### 2026-10-01 — Verificación de RLS
Ejecutado `supabase/verificar_rls.sql` en el SQL Editor: todas las tablas de `public` tienen `rls_activo = true`, y las 17 políticas de `pg_policies` coinciden con las documentadas. No hizo falta ningún cambio en la base.

### 2026-10-01 — Borrado definitivo en la app
La pantalla de detalle de un expediente archivado ofrece "Eliminar definitivamente", con doble confirmación (RF-17). Usa `eliminarExpedienteDefinitivo`, que borra primero los objetos del bucket y después el expediente (la cascada elimina filas de archivos y plazos).
