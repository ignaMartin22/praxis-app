## PraxisApp
Aplicación móvil diseñada para abogados, su principal función es brindar una gestión segura y organizada de sus expedientes.

## Stack
- Lenguaje: TypeScript
- Framework: React Native
- Base de datos: Supabase

## Estructura del proyecto
- 'screens/' contiene los screens principales de la aplicación
- 'context/' contiene configuraciones y estados globales de la aplicacion, usando Context Api

## No hagas
- Instalar dependencias sin avisar
- No subir archivos .env al repositorio

## Flujo de trabajo
- Antes de una tarea no trivial, propón un plan y espera mi OK.
- Una tarea a la vez; al terminar, dime qué cambiaste para que lo reviste.
- Si no estás seguro al 80%, pregunta. No inventes.

## Reglas de Seguridad e Integridad de Datos (CRÍTICO)
- **RLS y Políticas de Supabase:** NUNCA sugieras o modifiques políticas de Row Level Security (RLS) en Supabase para deshabilitarlas o hacerlas permissivas ("true"). Todo acceso a tablas debe estar estrictamente restringido por usuario (`auth.uid()`).
- **Manejo de Tokens y Claves:** 
  - NUNCA expongas la `SUPABASE_SERVICE_ROLE_KEY` en el cliente de React Native. Solo debe usarse la `SUPABASE_ANON_KEY`.
  - El token de sesión del abogado debe almacenarse únicamente en `expo-secure-store` o almacenamiento encriptado nativo, JAMÁS en `AsyncStorage` plano.
- **Privacidad de Expedientes (Datos Sensibles/Judiciales):**
  - No incluyas ni generes logs (`console.log`) que impriman datos personales de clientes, nombres de expedientes, DNIs o información judicial confidencial en producción.
  - No envíes payloads con datos reales a APIs de terceros sin validación previa.

## Reglas de Arquitectura y Código
- **Context API & Auth:**
  - `AuthContext` debe validar y actualizar el estado de autenticación de forma segura y escuchar los cambios de sesión de Supabase (`onAuthStateChange`).
  - No mezcles lógica de negocio ni consultas directas a Base de Datos dentro de los componentes visuales de `screens/`; extrae las consultas a servicios dedicados o hooks personalizados.
- **Tipado Estricto (TypeScript):**
  - Prohibido el uso de `any`. Define tipos explícitos e interfaces para todas las entidades de la base de datos (Expedientes, Clientes, Movimientos) basándote en los tipos generados de Supabase (`Database['public']['Tables']`).
- **Control de Errores:**
  - Todas las peticiones a Supabase deben incluir manejo de errores claro (`try/catch` o verificación de `error` devuelto) e informar al usuario de manera segura sin mostrar stack traces ni mensajes internos del backend.

## Restricciones de Modificación
- **Archivos Sensibles:** No modifiques de forma autónoma archivos de configuración crítica como `supabase/config.toml`, `app.json`, `eas.json` o scripts de migraciones de base de datos sin previo aviso y confirmación explicita.
- **Librerías Nativas:** No sugieras instalar librerías que requieran código nativo (`react-native link` o cambios en `android/`/`ios/`) sin advertir que requerirá un rebuild del cliente de desarrollo.

## Verificación y Calidad
- Antes de dar una tarea por finalizada, verifica que:
  1. El código no rompa los tipos de TypeScript (`tsc --noEmit`).
  2. No queden credenciales, variables hardcodeadas o logs innecesarios.