# Reservas Pizzburger — contexto del proyecto

App de reservas propia de **Pizzburger** (restaurante de pizzas y hamburguesas en Trujillo). Propietario: Ander. Sustituye a la app que había en Vento.

## Direcciones

| Qué | Dónde |
|---|---|
| Página de reservas (clientes) | https://reservaspizzburger.github.io/reservas-pizzburger/ |
| Panel interno (equipo) | https://reservaspizzburger.github.io/reservas-pizzburger/admin.html |
| Código | GitHub `reservaspizzburger/reservas-pizzburger` (rama `main`, pública) |
| Base de datos | Supabase, proyecto `pizzburger`, ref `qmkrkqsnvlsjdfrdejxk` (región Europa) |

## Cómo está montada

Solo hay tres piezas: **GitHub + Supabase + Claude**. No se usa Google Apps Script, Google Sheets, dominio propio ni Resend.

**Correos (desde el 4 nov 2026):** se envían **desde Gmail** (`reservaspizzburger@gmail.com`, contraseña de aplicación), sin dominio ni Resend. Solo hay dos correos al cliente: **confirmación** al reservar y **recordatorio ~2 h antes**. No hay avisos al restaurante, ni correo de modificación o cancelación. (El 3 nov se quitaron todos los correos y el 4 nov se pidió recuperar estos dos; la función de correos se recuperó del historial de git.)

| Archivo | Qué es | Cómo se publica |
|---|---|---|
| `index.html` | Página pública: calendario → personas → hora → datos → confirmación (con el enlace para cancelar y el teléfono). También la página de cancelar (`?cancelar=ID&codigo=…`) | GitHub Pages, sola al subir a `main` |
| `admin.html` | Panel: Reservas, Plano, Clientes, Aperturas y cierres, Servicios y horas, Mesas, Personalización, Estadísticas, Historial | GitHub Pages |
| `config.js` | URL de Supabase + clave pública *anon* + emails de los dos usuarios del panel | GitHub Pages |
| `supabase/schema.sql` | Toda la base de datos y la lógica, en PL/pgSQL. Es idempotente: se puede aplicar las veces que haga falta | Acción de GitHub «Supabase» al cambiar `supabase/**` |
| `supabase/functions/correo/` | Edge Function que envía los correos por Gmail (smtp.gmail.com:465). `plantillas.ts` tiene el diseño y los textos | Acción de GitHub «Supabase» |
| `.github/workflows/supabase.yml` | Aplica el SQL (en una sola transacción), guarda la clave de correos, publica la función y prueba el envío de punta a punta | — |

**Regla de oro:** los cambios se hacen en el repositorio y se suben a `main`. Nunca se pega código a mano en Supabase ni en ningún otro sitio.

## Base de datos (esquema privado `pzb`)

Tablas: `reservas`, `mesas`, `servicios`, `aperturas`, `config`, `clientes`, `auditoria`, `personal`, `secretos` (dirección y clave de la función de correos; solo la lee la base de datos).

Desde fuera solo se puede llamar a dos funciones (RPC):
- `public.publico(p jsonb)`: la usa la web, sin sesión. Acciones: `servicios`, `horarios` (con `todas:true` devuelve las horas para 1–10 personas de una vez), `reservar`, `verReserva` y `cancelar` (estas dos con el código de 64 caracteres de la reserva).
- `public.panel(p jsonb)`: la usa el panel y exige sesión de un email que esté en `pzb.personal`.
  - Equipo y administración: `yo`, `datos`, `guardarReserva`, `cambiarEstado`, `sugerirMesa`.
  - Solo administración: `auditoria`, `guardarServicios`, `guardarMesas`, `guardarApertura`, `guardarConfig`, `correoPrueba`, `importarClientes`, `importarReservas`.

Estados de una reserva: Pendiente, Confirmada, Sentados, Finalizada, Cancelada, No presentado. Las activas son Pendiente, Confirmada y Sentados.

**Cómo se envían los correos:** la base de datos encarga el envío con `pg_net` a la función `correo` (autenticada con la clave compartida `CLAVE_CORREO`, guardada en `pzb.secretos`) y la función habla con Gmail. Es asíncrono: «correo enviado» significa «encargado», no «entregado». Los recordatorios los lanza `pg_cron` cada 15 minutos (`pzb.enviar_recordatorios()`) y la columna `reservas.recordatorio` evita mandarlos dos veces. Si el encargo falla (por ejemplo, sin clave), el recordatorio **no** se marca y se reintenta en la siguiente pasada.

## Reglas de negocio

- **Horario:** cenas de miércoles a domingo, a horas fijas (20:00 a 22:30, cada 30 min, editables en el panel). Comidas configuradas para sábado y domingo, pero desactivadas por ahora. Duración de la mesa: 90 min. Máximo de 40 personas con reserva a la vez por servicio.
- **Días especiales** (cerrar o abrir un servicio un día concreto): tabla `aperturas`, que manda sobre el horario normal.
- **Mesa automática:** de las mesas libres durante toda la duración, la más ajustada al grupo, respetando el mínimo de cada mesa. Si empatan, mesa suelta antes que unión y la de mínimo más alto. Uniones definidas en `grupo` (06+07 con 10 plazas, 11+12, 13+14).
- **Reservas web:** se confirman al momento. Piden nombre, apellidos, **correo (obligatorio)** y teléfono. Máximo 10 personas y hasta 60 días de antelación. Si es para hoy, al menos 60 minutos antes. Misma reserva repetida = mismo teléfono (últimos 9 dígitos), día y hora activa: se rechaza.
- **Correos al cliente:** confirmación al reservar (web, y panel si se deja marcada la casilla «Enviar confirmación al cliente» al crear la reserva) y recordatorio unas 2 h antes. El recordatorio solo se envía a reservas *Confirmadas* con correo, y **no** a las creadas con menos de 2 h de antelación (acaban de recibir la confirmación). Si se cambia la fecha u hora de una reserva, su recordatorio se reinicia. Los textos y la dirección pública (para el enlace de cancelar) se cambian en Panel → Personalización → «Correos al cliente»; ahí también está «Enviar correo de prueba».
- **Cancelar:** al confirmar, la pantalla muestra el enlace de cancelación (con copiar) y el teléfono del local (el de Personalización); el mismo enlace va en el correo. Cancelar no envía ningún correo. **El código de cancelación solo se devuelve a quien acaba de reservar; nunca se devuelve en una reserva repetida**, porque con él se cancela y un teléfono no es un secreto. Quien no tenga el enlace llama y el equipo cancela desde el panel. Un cliente web cancelado aparece en el panel y en el Historial («Cancelada por el cliente»); no hay aviso al restaurante.
- **Panel:** se puede forzar una mesa ocupada o pasar de la capacidad. Avisa antes y pide confirmación. En el panel el correo es opcional; sin él no hay confirmación ni recordatorio.
- **Clientes:** ficha por correo, o por teléfono si no tiene correo (las reservas del panel sin correo quedan por teléfono). Se importan desde el panel (Clientes → Importar de Vento) con el CSV de Vento (1.310 fichas, que quedan en 1.288 al unir las repetidas). El nº de reservas de Vento se suma a las reservas nuevas de la app.

## Acceso al panel

Usuarios de Supabase Auth (Authentication → Users):
- `equipo@pizzburger.app`: reservas, plano y clientes.
- `admin@pizzburger.app`: todo.

El registro de usuarios nuevos debe estar **desactivado**.

## Secretos (en GitHub → Settings → Secrets and variables → Actions)

- `SUPABASE_DB_URL`: Session pooler; la contraseña, sin símbolos. **Imprescindible.**
- Para los correos (si falta alguno, la base de datos se actualiza igual pero la acción avisa de que los correos están apagados): `CLAVE_CORREO` (una clave inventada, larga), `GMAIL_APP_PASSWORD` (contraseña de aplicación de Gmail, 16 letras) y `SUPABASE_ACCESS_TOKEN` (token personal de Supabase).

**Seguridad:**
- Las claves y contraseñas nunca se pegan en el chat ni se suben al repositorio, que es público. Las pone Ander directamente en GitHub o en Supabase.
- Claude no escribe contraseñas ni tokens en ninguna web.
- La URL y la clave *anon* de `config.js` son públicas por diseño.

## Cómo trabajar con Claude

1. Ander describe el cambio («en el panel, en Plano, quiero…»), con una captura si es visual.
2. Claude cambia el código en el repositorio, lo prueba (Postgres local y navegador) y lo sube a `main`.
3. GitHub publica solo la web (1 minuto) y, si cambia `supabase/`, la base de datos y los correos.
4. Ander recarga la página para verlo.

Preferencias de Ander:
- Explicaciones en español, sin tecnicismos, con pasos numerados y concretos.
- Quiere que Claude lo haga todo y que él solo tenga que hacer lo imprescindible.
- La app tiene que «funcionar sola», sin depender de una persona.
- Antes de cambiar la estructura de los datos, preguntar.

## Estado (4 de noviembre de 2026)

Hecho:
- Base de datos creada en Supabase (14 mesas, horarios y días especiales de Vento).
- Web y panel publicados sobre Supabase; usuarios `equipo@` y `admin@` creados y probados.
- Calendario grande con las reservas de cada día, plano con las reservas sobre cada mesa e importación de clientes.
- Correos de confirmación y recordatorio (2 h antes) por Gmail, ya programados. Probado en Postgres local (base nueva y actualizada), con las plantillas y en navegador. **Falta probar el envío real a Gmail**, que depende de los secretos de abajo.

Pendiente (lo hace Ander):
1. Crear la contraseña de aplicación de Gmail y los tres secretos en GitHub (`GMAIL_APP_PASSWORD`, `CLAVE_CORREO`, `SUPABASE_ACCESS_TOKEN`), y relanzar la acción «Supabase» (GitHub → Actions → Supabase → Run workflow). Si el último paso («Probar el envío de punta a punta») sale en verde, los correos funcionan.
2. En el panel → Personalización: poner el teléfono del local (lo ve el cliente al confirmar y en el correo) y revisar los textos de «Correos al cliente».
3. En el panel → Clientes → Importar de Vento: subir el CSV de fichas de clientes. Opcional: el CSV de reservas antiguas.
4. Limpieza: borrar en GitHub → Actions las ejecuciones fallidas de «Supabase» y la rama `prueba-permisos`. Borrar el proyecto antiguo de Apps Script y la hoja de Google de reservas, que ya no se usan.

Ideas para más adelante: textos legales (condiciones y privacidad), activar las comidas de fin de semana, enlazar la reserva desde la web nueva de Pizzburger, correo de cancelación o aviso al restaurante si se echan en falta.
