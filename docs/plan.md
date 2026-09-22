# Plan — PraxisApp (MVP)

Deriva de `constitution.md` (reglas 1–14) y `specs.md` (RF-01..28). Nada de código: estructura, datos y justificaciones. Cada sección indica qué RF cubre.

## 1. Módulos

| Módulo | Responsabilidad | Regla de la constitución | RF |
|---|---|---|---|
| **Core / Auth** | Sesión (registro, login, logout), persistencia segura y reflejo de cambios de estado en toda la app | 1, 3, 4, 7 | RF-01, 03, 04, 05 |
| **Tenant / Aislamiento** | Creación del tenant propio al registrarse; expone el `tenant_id` activo; error seguro | 5, 8 | RF-02, 06, 07 |
| **Expedientes** | CRUD de expedientes, detalle, cambio de estado, archivar, restaurar y borrado definitivo con doble confirmación | 7, 8 | RF-09..17 |
| **Lista y filtros** | Búsqueda por apellido/carátula, filtro por estados y orden por vencimiento (sin fecha al final); refresh activo | 7 | RF-08, 13, 14, 15 |
| **Documentos PDF** | Adjuntar/listar/abrir/eliminar PDFs, límite de 5, validación de tipo y tamaño, URLs firmadas, confirmación de borrado | 7, 8 | RF-18..22 |
| **Vencimientos / Push** | Marcado visual de vencidos/próximos; push remoto día previo y día del vencimiento a todos los dispositivos; texto sin datos judiciales | 5, 6, 8 | RF-23..25 |
| **Offline / Caché** | Lectura offline con caché local; bloqueo de escrituras sin conexión; actualización al volver la conexión | 7 | RF-26..28 |
| **Navegación** | Estructura de pantallas y drawer; routing coherente para reflejar estado global | — | RF-04 |

## 2. Modelo de datos

### Supabase (persistencia)
- **`tenants`**: `id`, `owner_user_id` (→ `auth.users`), `creado_el`. Raíz de propiedad de datos. *Cubre RF-02, 06.*
- **`expedientes`**: `id`, `tenant_id` (→ `tenants`), `numero_expediente`, `caratula`, `cliente_apellido`, `estado` (enum: En inicio | En prueba | Para alegar | Sentencia | Archivado), `fecha_vencimiento` (nullable), `creado_el`. *Cubre RF-09..17.*
- **`expediente_pdfs`**: `id`, `expediente_id`, `tenant_id`, `storage_path`, `nombre_original`, `tipo_documento`, `tamano_bytes`, `creado_el`. El límite de 5 se define por regla de negocio en el módulo. *Cubre RF-18..22.*
- **Storage bucket `expediente-pdfs`**: objetos en `tenant_id/expediente_id/<uuid>.pdf`, acceso vía signed URL. *Cubre RF-22.*
- **`notification_tokens`**: `id`, `tenant_id`, `device_token`, `platform`, `creado_el`. Alimentos del dispositivo para push. *Cubre RF-24.*

### Supabase (backend, fuera de la app)
- **Disparador de vencimientos**: proceso que, para cada expediente con vencimiento hoy o mañana y estado no archivado, dispara el push al/los token(s) del tenant. *Cubre RF-23..25.*

### Local (expo-sqlite, solo lectura offline)
- **`expedientes_cache`** y **`pdfs_cache`**: copia del esquema de lectura necesaria por tenant; se sustituye/actualiza al volver la conexión. *Cubre RF-26..28.*

## 3. Decisiones justificadas (con alternativa descartada)

1. **Tenant explícito vía tabla `tenants`** en vez de usar `auth.uid()` directamente como dueño en cada fila. Descartada: menos indirección y menos tablas, pero rompe la decisión "estrictamente individual" si futuro se quiere estudio multiabogado, y ya el código existente trabaja con `tenant_id`. Se mantiene tenants por clara frontera de aislamiento y migración simple.
2. **Ciclo de vida = archivar + borrado definitivo con doble confirmación** en vez de solo soft-delete (`deleted_at`). Descartada: soft-delete eterno sin limpieza acumula datos judiciales sin necesidad y contradice la decisión acordada; el archivado cubre el caso "recuperable" y el borrado definitivo el de limpieza, y ambos son estados/acciones explícitos.
3. **Push remoto** en vez de notificación local de expo-notifications. Descartada: la local solo dispara el día en que la app generó la programación y no cubre "varios dispositivos" ni "app cerrada" de forma confiable. El push remoto con tokens por dispositivo cumple RF-24 tal como decidido.
4. **Caché offline con expo-sqlite** en vez de AsyncStorage plano o sin caché. Descartadas: sin caché viola RF-26; AsyncStorage no garantiza consulta estructurada ni índices y está prohibida para datos sensibles. El híbrido acordado no incluye cola de escrituras, así que el caché es de solo lectura (RF-26..28).
5. **Signed URLs (60 s) para los PDFs** en vez de URLs públicas en el bucket. Descartadas: URLs públicas en un bucket con expedientes judiciales rompen RF-22. Signed URL revalida por sesión.
6. **Límites por regla de negocio centralizada** (máx. 5 PDFs, tipos y tamaños) en un único servicio en vez de repetirlo en cada pantalla. Descartada: repetir la validación en la UI deriva en errores inconsistentes; centralizado es testable (regla 10).

## 4. Estrategia de tests

Estrategia en 3 capas, coherente con la constitución (reglas 9 y 10). No se mockea Supabase ni Expo salvo en integración; la lógica pura vive fuera de los componentes.

- **Unit (Jest + TypeScript, sin mock de Supabase/Expo):** toda lógica pura extraída en módulos: validación y rechazo de PDFs (RF-19, 20), filtros y orden de la lista con expedientes sin fecha (RF-13, 14), derivación de "vence hoy / vence mañana / vencido" (RF-23), cálculo de momentos de push y co-traducción del texto seguro (RF-24, 25), lógica de transición de estados y validación de archivar/restaurar (RF-10, 16). *El commit que rompe `tsc --noEmit` se rechaza (regla 9).*
- **Integración (Supabase local, dos cuentas reales):** aislamiento RLS probado con cuentas A y B sobre `expedientes`, `expediente_pdfs` y storage (RF-06, 22); límite de 5 sin huérfanos en storage (RF-19, criterio 6 del spec); doble confirmación y cascada del borrado definitivo (RF-17); sincronización de caché al volver la conexión (RF-28, criterio 9).
- **QA manual (checklist de release):** un punto de verificación por RF-01..28, incluyendo push en los dos momentos programados (criterio 8) y persistencia de sesión (criterio 4).

Cobertura por área: Auth → unit+QA (RF-01..05); Aislamiento → integración+QA (RF-06..08); Expedientes → unit+QA (RF-09..17); PDFs → unit+integración+QA (RF-18..22); Vencimientos/Push → unit+QA (RF-23..25); Offline → integración+QA (RF-26..28).