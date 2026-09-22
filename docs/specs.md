# Spec — PraxisApp (MVP)

**Por qué:** brindar al abogado una gestión segura y organizada de sus expedientes, con datos judiciales aislados por usuario, control de vencimientos y consulta de documentos incluso sin conexión.
**Qué:** requisitos del MVP completo. Nada de cómo se implementa.

## Decisiones acordadas (para el registro)
- Alcance: app completa (MVP).
- Conexión: híbrido — lectura offline, escritura online.
- Aislamiento de datos: estrictamente individual por abogado (tenant).
- Ciclo de vida del expediente: archivar + borrado definitivo con doble confirmación.
- Vencimientos: push remoto el día previo y el día del vencimiento.

## Requisitos funcionales (EARS)

### Autenticación y cuenta
- **RF-01**: El abogado DEBE poder registrarse con email y contraseña y autenticarse para usar la app. *Por qué: sin identidad no hay aislamiento ni RLS.*
- **RF-02**: CUANDO el abogado se registra, el sistema DEBE crear su tenant propio, raíz de la propiedad de todos sus datos.
- **RF-03**: La sesión DEBE persistir entre aperturas de la app hasta que el abogado cierre sesión explícitamente.
- **RF-04**: CUANDO el estado de autenticación cambia (login/logout), el sistema DEBE reflejarlo en toda la app sin reinicios ni recargas manuales.
- **RF-05**: El abogado DEBE poder cerrar sesión desde cualquier pantalla principal.

### Aislamiento de datos
- **RF-06**: El sistema DEBE restringir toda consulta de expedientes y documentos al tenant del abogado autenticado; MIENTRAS no exista relación explícita, ningún abogado DEBE poder ver o modificar datos de otro. *Por qué: los expedientes contienen información judicial confidencial.*
- **RF-07**: Los mensajes de error al abogado DEBEN ser claros y seguros: sin stack traces, sin identificadores internos ni datos de terceros.
- **RF-08**: La app DEBE abrir regularmente los datos sin pedir al usuario que recuerde refrescar manualmente.

### Expedientes
- **RF-09**: El abogado DEBE poder crear un expediente con número de expediente, carátula, apellido del cliente, estado inicial y fecha de vencimiento opcional.
- **RF-10**: El estado de un expediente DEBE ser uno de: En inicio, En prueba, Para alegar, Sentencia, Archivado.
- **RF-11**: El abogado DEBE poder consultar el detalle de un expediente con su número, carátula, cliente, estado, vencimiento y documentos.
- **RF-12**: El abogado DEBE poder cambiar el estado de un expediente a cualquiera de los estados válidos.
- **RF-13**: En la lista, el abogado DEBE poder buscar por apellido del cliente o carátula.
- **RF-14**: En la lista, el abogado DEBE poder filtrar por uno o más estados y ordenar por vencimiento próximo; los expedientes sin fecha DEBEN quedar al final del orden.
- **RF-15**: CUANDO un operación modifica expedientes (creación, cambio de estado), la lista DEBE reflejar el cambio sin obligar al abogado a recargar.
- **RF-16**: El abogado DEBE poder archivar un expediente, y CUANDO esté archivado, DEBE poder restaurarlo a un estado activo.
- **RF-17**: CUANDO el abogado solicita el borrado definitivo de un expediente, el sistema DEBE pedir doble confirmación antes de actuar, y DEBE eliminar también los documentos asociados.

### Documentos PDF
- **RF-18**: El abogado DEBE poder adjuntar, listar, abrir y eliminar documentos PDF de un expediente.
- **RF-19**: El sistema DEBE aceptar como máximo 5 PDFs por expediente; CUANDO el límite se alcanza, el sistema DEBE impedir nuevas cargas y avisarlo con claridad.
- **RF-20**: El sistema DEBE rechazar archivos que no sean PDF (por formato o extensión) y archivos que superen el tamaño máximo permitido.
- **RF-21**: CUANDO el abogado solicita eliminar un PDF, el sistema DEBE pedir confirmación antes del borrado (irreversible).
- **RF-22**: Los documentos DEBEN estar aislados por tenant: solo su dueño puede listarlos, abrirlos o eliminarlos.

### Vencimientos y notificaciones
- **RF-23**: La app DEBE hacer visible cuándo un expediente vence o ya venció.
- **RF-24**: CUANDO un expediente vence en 1 día, o el mismo día del vencimiento, el sistema DEBE enviar una notificación push al abogado, llegando a todos sus dispositivos sin que la app esté abierta.
- **RF-25**: El texto de la notificación DEBE identificar el vencimiento sin exponer datos judiciales sensibles.

### Modo hibrido (lectura offline, escritura online)
- **RF-26**: El abogado DEBE poder consultar expedientes y documentos ya cargados sin conexión.
- **RF-27**: CUANDO no hay conexión, toda escritura (crear, cambiar estado, archivar, borrar, subir o eliminar PDF) DEBE bloquearse con un aviso claro; el sistema NO DEBEe reportar éxito de una operación que no se persistió.
- **RF-28**: CUANDO se restaura la conexión, la app DEBE actualizar los datos consultados contra la fuente, sin que el abogado tenga que hacerlo manualmente.

## Fuera de alcance (MVP)
- Compartición de expedientes entre abogados o estudios (decision: estrictamente individual).
- Edición de los datos creados del expediente (carátula, número, cliente, vencimiento); solo el estado es editable en el MVP.
- Cliente como entidad gestionada; en el MVP el cliente es solo el apellido del expediente.
- Soporte de otros tipos de documento (docx, jpg, png) en la interfaz; el MVP adjunta únicamente PDF.
- Escrituras offline con sincronización diferida (colas de pendientes).
- Borrado de cuenta y reaprovechamiento de email.
- Multilenguaje, temas, y roles dentro de un tenant.
- Visor de PDF embebido en la app; el PDF se abre con el visor externo del dispositivo.

## Criterios de finalización (verificables)
1. `tsc --noEmit` finaliza sin errores.
2. Probado con dos cuentas A y B: A no ve ni modifica expedientes/PDFs de B, y viceversa.
3. Verificado en todo acceso a tablas usado por la app que RLS restringe por `auth.uid()`; sin políticas abiertas.
4. La sesión persiste en `expo-secure-store`; no se usa AsyncStorage para tokens ni sesiones.
5. Sin credenciales hardcodeadas y sin `console.log` con datos de clientes en el código entregado.
6. Se llega al límite de 5 PDFs y el sistema lo bloquea y lo avisa sin dejar archivos huérfanos.
7. Un expediente archivado se restaura; un borrado definitivo exige doble confirmación y elimina sus PDFs.
8. Push de vencimiento verificable en los dos momentos (día previo y día del vencimiento).
9. Con la conexión apagada, se consulta el expediente cacheado y toda escritura falla con aviso claro; al volver la conexión se actualiza.
10. Todo requisito 01–28 tiene un punto de verificación manual escrito en el checklist de QA del release.