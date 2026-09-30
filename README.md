**PraxisApp**

*Tu práctica, organizada y al día. Una app móvil para que abogados gestionen sus expedientes de forma segura, con los datos aislados por estudio.*

* [Especificación del MVP](docs/specs.md)
* [Plan técnico](docs/plan.md)
* [Constitución del proyecto](docs/constitution.md)
* [Base de datos y políticas RLS](docs/base-de-datos.md)

## Qué hace

1. **Registro:** el abogado crea su cuenta con email y contraseña y el nombre de su estudio. Al registrarse se crea su *tenant*, la raíz de propiedad de todos sus datos.
2. **Expedientes:** crea expedientes con número, carátula, apellido del cliente, estado y fecha de vencimiento opcional.
3. **Lista:** busca por apellido o carátula, filtra por uno o más estados y ordena por vencimiento próximo (los que no tienen fecha quedan al final).
4. **Detalle:** consulta el expediente, cambia su estado y adjunta hasta 5 documentos.
5. **Archivo:** archiva un expediente deslizando la fila (o desde el detalle) y lo restaura a un estado activo desde "Expedientes archivados".

## Qué lo hace distinto

* **Aislamiento por tenant, reforzado en la base.** Cada tabla y el bucket de archivos tienen políticas RLS que restringen el acceso al dueño (`auth.uid()`). Ninguna política es abierta.
* **Archivos privados.** Los documentos viven en un bucket privado de Supabase Storage bajo `{tenant_id}/{expediente_id}/`. Se abren con URL firmada de 60 segundos.
* **Límite defendido en dos capas.** Máximo 5 archivos por expediente, validado en la app y con un trigger en Postgres.
* **Validación de archivos.** Se verifica tipo MIME, extensión y tamaño (15 MB para PDF y DOCX, 10 MB para JPG y PNG) antes de subir. Si falla el registro en la base, el archivo subido se elimina para no dejar huérfanos.
* **Errores seguros.** La app muestra mensajes claros al usuario, sin stack traces ni detalles internos del backend.
* **Sin clientes como entidad.** El cliente es solo el apellido dentro del expediente; no se gestiona como registro aparte.

## Funciones

| Función | Dónde | Qué hace |
|---|---|---|
| Registro / Login | `RegisterScreen`, `LoginScreen` | Alta con email y contraseña, creación del tenant y acceso a la app |
| Sesión global | `context/AuthContext.tsx` | Mantiene la sesión, escucha `onAuthStateChange`, resuelve el `tenant_id` y expone `signOut` |
| Lista de expedientes | `HomeScreen` | Búsqueda, filtros por estado, orden por vencimiento y refresco en tiempo real (Supabase Realtime) |
| Nuevo expediente | `CrearExpedienteScreen` | Alta con selector de estado y fecha de vencimiento |
| Detalle | `ExpedienteDetalleScreen` | Datos del expediente, cambio de estado, archivar y restaurar, gestión de documentos |
| Archivados | `ExpedientesArchivadosScreen` | Lista de expedientes archivados con búsqueda y restauración |
| Menú lateral | `components/SideDrawer.tsx` | Navegación con gesto de deslizar, email del usuario y cierre de sesión |
| Documentos | `services/expedientePdfs.ts` | Subir, listar, abrir y eliminar documentos con validaciones y límite |
| Expedientes | `services/expedientes.ts` | Consultas, archivar y restaurar |

Estados de un expediente: `En inicio`, `En prueba`, `Para alegar`, `Sentencia` y `Archivado`.

## Arquitectura

```
React Native (Expo)  ──►  services/  ──►  Supabase
  screens/ (UI)            consultas        Auth · Postgres (RLS) · Storage · Realtime
  context/ (Auth)          y reglas
```

| Carpeta | Contenido |
|---|---|
| `screens/` | Pantallas principales de la app |
| `components/` | Componentes compartidos (menú lateral, filas deslizables) |
| `context/` | Estado global con Context API (`AuthContext`) |
| `services/` | Consultas a Supabase y reglas de negocio |
| `types/` | Tipos de entidades y de navegación |
| `supabase/` | Scripts SQL de la base (tablas, funciones, políticas, migraciones) |
| `docs/` | Especificación, plan, constitución y documentación de la base |

### Modelo de datos

| Tabla | Para qué sirve |
|---|---|
| `tenants` | Un estudio/abogado; raíz del aislamiento de datos |
| `expedientes` | Entidad central: número, carátula, cliente, estado, vencimiento |
| `expediente_pdfs` | Metadata de los archivos adjuntos (los bytes están en Storage) |
| `plazos` | Vencimientos procesales con aviso previo (aún sin uso en la app) |
| `notification_tokens` | Tokens de push por dispositivo (aún sin uso en la app) |

El detalle completo de columnas, funciones y políticas está en [docs/base-de-datos.md](docs/base-de-datos.md).

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| App | React Native 0.86, Expo 57, React 19 |
| Navegación | React Navigation (native stack) |
| Backend | Supabase (Auth, Postgres, Storage, Realtime) |
| Archivos | `expo-document-picker` |
| Fechas | `@react-native-community/datetimepicker` |

## Estado

* MVP en desarrollo. Funcionan: autenticación, expedientes (crear, listar, filtrar, cambiar estado, archivar, restaurar) y documentos.
* **Pendiente:** borrado definitivo de expedientes con doble confirmación (la base ya lo permite; falta la pantalla y eliminar los archivos de Storage primero).
* **Pendiente:** notificaciones push de vencimientos. Las tablas `plazos` y `notification_tokens` existen, pero la app todavía no las usa.
* **Pendiente:** lectura sin conexión con caché local.
* No hay tests automatizados todavía.

## Riesgos, dicho claramente

* **La sesión se guarda en `AsyncStorage`.** El proyecto exige `expo-secure-store`, que aún no está integrado. Es la deuda de seguridad más importante.
* **La URL y la clave pública de Supabase están en el código** (`supabase.ts`). Es la clave `anon`/publishable, pensada para el cliente, y la seguridad depende de RLS. Conviene moverlas a variables de entorno.
* **Confirmar RLS activo en todas las tablas.** El repositorio documenta las políticas, pero hay que verificar en la base que cada tabla tenga RLS habilitado (consulta en [docs/base-de-datos.md](docs/base-de-datos.md)).
* **Borrado en cascada no limpia Storage.** Eliminar un expediente borra sus filas de archivos, pero no los objetos del bucket, hasta que la app lo haga explícitamente.

## Correrlo localmente

Requisitos: Node.js, la app Expo Go (o un emulador) y acceso a un proyecto de Supabase con el esquema aplicado.

```bash
npm install
npm start
```

Otros comandos:

| Script | Qué hace |
|---|---|
| `npm start` | Inicia el servidor de desarrollo de Expo |
| `npm run android` | Abre la app en un emulador o dispositivo Android |
| `npm run ios` | Abre la app en un simulador iOS |
| `npm run web` | Abre la versión web |

Verificación de tipos:

```bash
npx tsc --noEmit
```

### Base de datos

Los scripts de `supabase/` se ejecutan en el SQL Editor del dashboard de Supabase:

| Script | Qué hace |
|---|---|
| `expediente_pdfs.sql` | Funciones de tenancy, bucket privado, tabla de archivos, políticas RLS y límite de 5 archivos |
| `expedientes_delete_y_drop_documentos.sql` | Política DELETE en `expedientes` y baja de la tabla obsoleta `documentos` |

## Documentos

| Leé esto | Para |
|---|---|
| [docs/specs.md](docs/specs.md) | Requisitos funcionales (RF-01 a RF-28) y criterios de finalización |
| [docs/plan.md](docs/plan.md) | Módulos, modelo de datos, decisiones y estrategia de tests |
| [docs/constitution.md](docs/constitution.md) | Reglas de stack, calidad, seguridad y trabajo |
| [docs/base-de-datos.md](docs/base-de-datos.md) | Esquema, políticas RLS e historial de cambios de la base |
| [AGENTS.md](AGENTS.md) | Guía para asistentes de código que trabajan en el repositorio |

## Acerca de

PraxisApp es un proyecto en desarrollo para abogados. Repositorio: [ignaMartin22/praxis-app](https://github.com/ignaMartin22/praxis-app).
