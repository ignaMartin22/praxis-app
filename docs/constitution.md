# Constitución de PraxisApp

## Stack
1. Solo TypeScript estricto; cero `any` y cero `assert as any` (verificable con `tsc --noEmit`).
2. React Native/Expo; ninguna librería con código nativo sin avisar y autorizar rebuild.
3. Supabase con `SUPABASE_ANON_KEY` únicamente en cliente; la service-role key jamás en el bundle.
4. Sesión del abogado solo en `expo-secure-store`; nunca en AsyncStorage plano.

## Calidad
5. RLS activo en toda tabla: acceso solo vía `auth.uid()`; nunca políticas abiertas (`true`).
6. Sin `console.log` en producción; sin datos personales/judiciales en logs ni payloads a terceros.
7. Queries y lógica de negocio fuera de `screens/` (services o hooks); screens solo presentación.
8. Errores de Supabase siempre en `try/catch` y mostrados al usuario sin stack traces.

## Tests
9. Cada tarea termina con `tsc --noEmit` pasando (commit no válido si rompe tipos).
10. Lógica pura extraída para testear sin mock del runtime (supabase-js, expo).

## Límites
11. No tocar `supabase/config.toml`, `app.json`, `eas.json` ni migraciones sin confirmación explícita.
12. No instalar dependencias sin avisar; evaluar primero si existe una nativa ya en el stack.
13. No inventar: pregunta si la certeza es < 80%.

## Trabajo
14. Plan antes de tareas no triviales; una tarea a la vez, reportar al terminar.