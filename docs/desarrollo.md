# PraxisApp — Documentación de desarrollo

Estado de la funcionalidad desarrollada en la aplicación, mapeada contra los requisitos de `docs/specs.md` (RF-01..28).

## Leyenda
- ✅ Implementado
- ⏳ En proceso
- ❌ No implementado

## Módulos

### Autenticación y cuenta
| RF | Requisito | Estado |
|---|---|---|
| RF-01 | Registro con email/contraseña y autenticación | ✅ |
| RF-02 | Creación de tenant propio al registrarse | ✅ |
| RF-03 | Sesión persistente entre aperturas | ✅ (storage en `expo-secure-store`) |
| RF-04 | Cambios de auth reflejados en toda la app | ✅ |
| RF-05 | Cerrar sesión desde cualquier pantalla | ✅ |

### Aislamiento de datos
| RF | Requisito | Estado |
|---|---|---|
| RF-06 | Datos restringidos por tenant (RLS) | ✅ |
| RF-07 | Mensajes de error claros y seguros | ✅ (auth traducido a mensajes seguros; revisar el resto) |
| RF-08 | Datos abiertos sin refresco manual | ✅ (realtime + focus) |

### Expedientes
| RF | Requisito | Estado |
|---|---|---|
| RF-09 | Crear expediente | ✅ (gate offline RF-27) |
| RF-10 | Estados válidos | ✅ |
| RF-11 | Detalle del expediente | ✅ (lectura cache offline RF-26) |
| RF-12 | Cambiar estado | ✅ (gate offline RF-27) |
| RF-13 | Buscar por apellido o carátula | ✅ |
| RF-14 | Filtrar por estados y ordenar por vencimiento | ✅ |
| RF-15 | La lista refleja cambios sin recargar | ✅ |
| RF-16 | Archivar y restaurar | ✅ (gate offline RF-27) |
| RF-17 | Borrado definitivo con doble confirmación | ✅ (botón en el detalle del expediente archivado, confirmar escribiendo ELIMINAR) |

### Documentos PDF
| RF | Requisito | Estado |
|---|---|---|
| RF-18 | Adjuntar, listar, abrir y eliminar PDFs | ✅ (metadatos cache offline RF-26; abrir PDF requiere red) |
| RF-19 | Máximo 5 PDFs por expediente | ✅ |
| RF-20 | Rechazo de no-PDF y archivos grandes | ✅ |
| RF-21 | Confirmación al eliminar PDF | ✅ |
| RF-22 | PDFs aislados por tenant | ✅ |

### Vencimientos y notificaciones
| RF | Requisito | Estado |
|---|---|---|
| RF-23 | Marcado visual de vencido/próximo | ✅ (Vencido / Hoy / Mañana / Próximo 7d) |
| RF-24 | Push remoto día previo y día del vencimiento | ⏳ Código listo; **pendiente de habilitación** (ver notas Fase 3) |
| RF-25 | Texto de notificación sin datos sensibles | ⏳ Definido en la edge function; se valida al habilitar |

### Modo híbrido (lectura offline, escritura online)
| RF | Requisito | Estado |
|---|---|---|
| RF-26 | Consultar datos cargados sin conexión | ✅ (cache SQLite local Fase 2) |
| RF-27 | Bloquear escrituras sin conexión | ✅ (gate en servicios de escritura) |
| RF-28 | Actualizar datos al volver la conexión | ✅ (resync automático al reconectar) |

## Notas técnicas y deuda
- **Sesión segura:** `supabase.ts` guarda la sesión en `expo-secure-store` vía adaptador `services/secureStorage.ts` (Keychain/Keystore). Cumple la regla 4 de la constitución y AGENTS.md. `@react-native-async-storage/async-storage` quedó sin uso en el código (dependencia aún en `package.json`, pendiente remover). `expo install` agregó `expo-secure-store` al plugin de `app.json`.
- **RF-07:** los errores de autenticación se traducen con `services/authErrors.ts` (`mensajeErrorAuth`) a mensajes seguros sin exponer texto crudo del backend.
- **RF-17:** el borrado definitivo está solo en el detalle del expediente archivado (botón "Eliminar definitivamente" bajo "Restaurar expediente"). Pide doble confirmación (Alert + tipear ELIMINAR). Borra primero los objetos del storage `expediente-pdfs` (RLS permite borrar en la carpeta del propio tenant) y luego la fila de `expedientes`; el `on delete cascade` de `expediente_pdfs` limpia la metadata. Nunca reporta éxito sin persistir.
- **RF-23:** lógica pura en `services/vencimiento.ts` (`derivarVencimiento`), comparación por fecha pura sin TZ. Badges en `HomeScreen` y `ExpedienteDetalleScreen`.
- **Fase 2 (RF-26..28):**
  - `services/connectividad.ts`: singleton `NetInfo`, `getIsOnline()`, `requiereConexion()` (mensaje claro si no hay red) y `initConnectividad()` llamado en `App.tsx`. Singleton suscrito una única vez; los hooks consumen `getIsOnline`/`useOnline`.
  - `services/cache.ts`: `expo-sqlite` (`praxis-cache.db`, PRAGMA WAL) con tablas `expedientes_cache` y `pdfs_cache`. Solo guarda **expedientes + metadatos de PDF**, no el contenido. Escritura *best-effort* con `catch` silencioso para no romper el flujo online.
  - Write-through: Home, Archivados y Detalle guardan en caché lo que devuelve Supabase al estar online; sin red leen de la caché (RF-26).
  - RF-27: gates en `crearExpediente`, `cambiarEstadoExpediente`, `archivarExpediente`, `restaurarExpediente`, `eliminarExpedienteDefinitivo`, `subirDocumento`, `eliminarPdf` → devuelven `error: string` claro, nunca éxito falso.
  - RF-28: resync en los tres screens con patrón `useOnline()` + `onlineRef` (se refresca al pasar de offline a online).
  - `abrirPdf` muestra "Necesitás conexión" si está offline (el contenido real no se cachea).
- **Fase 3 (RF-24/25, push remoto):**
  - Backend: tabla `notification_tokens` (migración `supabase/notification_tokens.sql`, RLS solo propio tenant, sin UPDATE) + edge function `supabase/functions/push-vencimientos/index.ts` (exige service role, una notificación por tenant por día, agrupa HOY/MAÑANA, limpia tokens `DeviceNotRegistered` de Expo) + `supabase/config.toml` con `cron = "0 9 * * *"` (09:00, zona horaria del servidor; ajustable).
  - Cliente: `services/push.ts` (`configurarPush` con canal Android `vencimientos`, `sincronizarPushAlIniciar` pide permiso una sola vez y registra el token, `sincronizarPushActivo` re-registra al volver a foreground sin re-preguntar, hook `useEstadoPush`). Integrado en `App.tsx` (componente `PushSynchronizer`: setup + sync al iniciar con sesión + listener de `AppState`). Si el permiso está otorgado pero el registro falla, la app muestra una Alert con la causa ("falta extra.eas.projectId", "¿Expo Go?", "migración no aplicada") para que el diagnóstico no sea silencioso.
  - Banner en `HomeScreen` cuando el permiso push fue denegado → botón "Activar" → `Linking.openSettings()` (sin re-pedir por sistema, según decisión acordada).
  - **Condiciones reales para que el token exista (importantes):**
    1. `app.json` DEBE tener `extra.eas.projectId` (proyecto de Expo/EAS): `getExpoPushTokenAsync` lanza `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID` sin él. Obtener via `npx eas-cli init` (crea el proyecto y lo escribe) o `expo.dev → proyecto → Settings → Project ID`.
    2. La app DEBE correr en un **development build** (`npx expo run:android` / `eas build --profile development`) en un **dispositivo físico**: desde SDK 53 **Expo Go no soporta push remotos**.
  - `app.json`: plugin `expo-notifications` (`color: #C7A56A`). `expo-notifications ~57.0.18` ya estaba en dependencias pero sin uso → **requiere rebuild del dev client**. `expo-constants` se usa vía dependencia transitiva de `expo` (no se agregó a `package.json`).
  - Deploy: correr `supabase/notification_tokens.sql` en el SQL Editor del proyecto hosted, luego `supabase functions deploy push-vencimientos --project-ref <REF>`. Prueba manual: invocar con `Authorization: Bearer <SERVICE_ROLE_KEY>` para simular el cron. Criterio 8 del spec: verificar en los dos momentos (día previo y el mismo día).
  - `tsconfig.json` excluye `supabase/functions` (código Deno) del typecheck de la app.
  - **Estado actual: código completo pero PENDIENTE DE HABILITACIÓN** (decisión: se implementa más adelante). El cliente queda inofensivo: si no hay permiso otorgado no molesta, y si no puede registrar el token muestra la Alert diagnóstica. Checklist para retomarlo:
    1. `supabase/notification_tokens.sql` en el SQL Editor del proyecto hosted.
    2. `npx eas-cli login` + `npx eas-cli init` → escribe `extra.eas.projectId` en `app.json`.
    3. Development build en dispositivo físico (`npx expo run:android` o `eas build --profile development`).
    4. `supabase functions deploy push-vencimientos --project-ref <REF>`.
    5. Verificar que se registra el token (`select * from public.notification_tokens;`) y probar el envío manual del cron (POST con `Authorization: Bearer <SERVICE_ROLE_KEY>`). Criterio 8 del spec: comprobar los dos momentos (día previo y el mismo día).
- **Teclado:** todas las pantallas con inputs envuelven su contenido en `KeyboardAvoidingView` (`behavior: padding` en iOS; Android resuelve con `adjustResize`). En pantallas con header nativo (`CrearExpediente`, `ExpedientesArchivados`) se usa `keyboardVerticalOffset = insets.top + 44`; `RegisterScreen` usa además `ScrollView` para evitar recorte en pantallas chicas. El modal de borrado de `ExpedienteDetalleScreen` también está envuelto en KAV.
- **RLS:** solo `supabase/expediente_pdfs.sql` está versionado. RLS de `tenants` y `expedientes` asumido desde el dashboard, no en el repo.
- **Tests:** la estrategia del plan (unit Jest, integración, QA) no está implementada; no hay infraestrutura de tests.

## Arquitectura
- `screens/` — presentación (sin lógica de negocio directa; las queries salen por `services/`).
- `services/` — consultas a Supabase y lógica pura.
- `context/AuthContext.tsx` — sesión y `tenant_id` global.
- `components/` — reutilizables (`SideDrawer`, `SwipeableActionRow`).
- `types/` — tipados de navegación y entidades.
- `theme.ts` — colores, spacing, radios.