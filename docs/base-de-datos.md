# Base de datos — PraxisApp

Documento de referencia del esquema de Supabase (Postgres + Storage) y de las políticas RLS vigentes.
Fuente: esquema y `pg_policies` exportados del proyecto; `supabase/expediente_pdfs.sql`; uso real en el código (`services/`, `screens/`, `context/`).

> Estado verificado el 2026-09-30. Las políticas listadas son las que devolvió `pg_policies`; esa vista **no indica si RLS está habilitado** en cada tabla (ver [Pendientes](#pendientes-y-mejoras-recomendadas)).

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

### `expediente_pdfs`
Metadata de los archivos adjuntos de un expediente. Los bytes viven en Storage (bucket `expediente-pdfs`). Pese al nombre, el esquema admite `pdf`, `docx`, `jpg`, `png`; la UI del MVP solo adjunta PDF.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `expediente_id` | uuid NOT NULL | FK → `expedientes(id)` (`ON DELETE CASCADE` según el script SQL) |
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
| `expediente_id` | uuid | nullable, FK → `expedientes(id)` |
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

### `documentos` — tabla obsoleta
| Columna | Tipo |
|---|---|
| `id` | uuid PK |
| `expediente_id` | uuid (FK → `expedientes`) |
| `tenant_id` | uuid NOT NULL (sin FK) |
| `nombre_archivo`, `storage_path` | varchar NOT NULL |
| `tipo` | varchar |
| `creado_el` | timestamptz |

**Verificación en el repositorio:** ninguna consulta `.from('documentos')` en `services/`, `screens/`, `context/` ni `types/`. Los únicos textos "documentos" son etiquetas de UI y menciones en `docs/` que se refieren a los archivos de `expediente_pdfs`. `supabase/expediente_pdfs.sql` no la crea ni la toca. Es un remanente de un diseño anterior que `expediente_pdfs` reemplazó, sin ventajas sobre esta (menos campos, sin FK de tenant, sin límite, sin políticas de borrado). **Conclusión: no tiene sentido mantenerla.** Antes de eliminarla, comprobar que está vacía (ver [Pendientes](#pendientes-y-mejoras-recomendadas)).

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
| `plazos` | SELECT | usuarios ven plazos de su tenant | public | `tenant_id IN (tenants del usuario)` |
| `plazos` | INSERT | usuarios crean plazos en su tenant | public | ídem (WITH CHECK) |
| `documentos` | SELECT / INSERT | usuarios ven / crean documentos en su tenant | public | `tenant_id IN (tenants del usuario)` |
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
`tenants` UPDATE/DELETE · `expedientes` **DELETE** · `plazos` UPDATE/DELETE · `documentos` UPDATE/DELETE · `expediente_pdfs` UPDATE · `notification_tokens` UPDATE · Storage UPDATE.

## 5. Uso real desde la app

| Tabla / recurso | Dónde se usa |
|---|---|
| `tenants` | `context/AuthContext.tsx`, `screens/RegisterScreen.tsx` |
| `expedientes` | `services/expedientes.ts`, `screens/ExpedienteDetalleScreen.tsx`, `screens/CrearExpedienteScreen.tsx` |
| `expediente_pdfs` + bucket | `services/expedientePdfs.ts` |
| `plazos`, `notification_tokens`, `documentos` | sin uso |

## Pendientes y mejoras recomendadas

Ordenadas por prioridad. Ninguna está aplicada; cualquier cambio en `supabase/` requiere confirmación previa.

1. **Falta política DELETE en `expedientes`.** El RF-17 (borrado definitivo) no puede funcionar mientras no exista. Debe ser `is_tenant_owner(tenant_id)`, no `true`.
2. **Confirmar que RLS está habilitado** en todas las tablas: `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';`
3. **Eliminar `documentos`** (y sus dos políticas) tras comprobar que está vacía: `select count(*) from public.documentos;`.
4. **Cambiar el rol `public` por `authenticated`** en las políticas de `tenants`, `expedientes` y `plazos`, y unificarlas con `is_tenant_owner()`. Hoy funcionan porque `auth.uid()` es NULL para anónimos, pero `authenticated` es más explícito.
5. **Borrado en cascada y Storage:** `ON DELETE CASCADE` elimina filas de `expediente_pdfs`, pero no los objetos de Storage. El borrado definitivo debe eliminar primero los archivos del bucket desde la app.
6. **Integridad cruzada de `tenant_id`:** nada impide que un hijo tenga un `tenant_id` distinto al de su expediente (solo `expediente_pdfs` lo valida en su política INSERT). Solución: clave única `(id, tenant_id)` en `expedientes` y FK compuesta en las tablas hijas.
7. **Validación de `estado`:** agregar `CHECK` con los cinco valores (el plan lo describe como enum, pero en la base es `varchar`).
8. **`notification_tokens`:** agregar `UNIQUE (device_token)`, una política UPDATE (necesaria para `upsert`) y evaluar atarlo a `user_id`.
9. **`plazos`:** completar FK de `tenant_id`, hacer `expediente_id` obligatorio si no habrá plazos sueltos, y definir si reemplazará a `expedientes.fecha_vencimiento` (hoy hay dos fechas de vencimiento).
10. **Índices:** `expedientes (tenant_id, estado)`, `plazos (expediente_id)`, y un índice parcial `plazos (fecha_vencimiento) WHERE notificado = false` para el job de avisos.
11. **Renombrar `expediente_pdfs`** a `expediente_archivos` si se habilitan otros tipos de archivo.
12. Agregar `UNIQUE (tenant_id, numero_expediente)` si el número no debe repetirse dentro de un estudio.
