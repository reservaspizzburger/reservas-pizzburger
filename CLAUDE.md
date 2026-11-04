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

Solo hay tres piezas: **GitHub + Supabase + Claude**. No se usa Google Apps Script, Google Sheets, dominio propio, Resend ni Gmail.

**La app NO envía correos** (decisión de Ander, 3 nov 2026). No hay confirmaciones, recordatorios ni avisos por correo. Si algún día se quisiera volver a enviar, habría que montarlo de cero (hace falta un dominio propio con un servicio de envío); hoy no se usa.

| Archivo | Qué es | Cómo se publica |
|---|---|---|
| `index.html` | Página pública: calendario → personas → hora → datos → confirmación (con el enlace para cancelar y el teléfono). También la página de cancelar (`?cancelar=ID&codigo=…`) | GitHub Pages, sola al subir a `main` |
| `admin.html` | Panel: Reservas, Plano, Clientes, Aperturas y cierres, Servicios y horas, Mesas, Personalización, Estadísticas, Historial | GitHub Pages |
| `config.js` | URL de Supabase + clave pública *anon* + emails de los dos usuarios del panel | GitHub Pages |
| `supabase/schema.sql` | Toda la base de datos y la lógica, en PL/pgSQL. Es idempotente: se puede aplicar las veces que haga falta | Acción de GitHub «Supabase» al cambiar `supabase/**` |
| `.github/workflows/supabase.yml` | Aplica el SQL y comprueba el resultado | — |

**Regla de oro:** los cambios se hacen en el repositorio y se suben a `main`. Nunca se pega código a mano en Supabase ni en ningún otro sitio.

## Base de datos (esquema privado `pzb`)

Tablas: `reservas`, `mesas`, `servicios`, `aperturas`, `config`, `clientes`, `auditoria`, `personal`.

Desde fuera solo se puede llamar a dos funciones (RPC):
- `public.publico(p jsonb)`: la usa la web, sin sesión. Acciones: `servicios`, `horarios` (con `todas:true` devuelve las horas para 1–10 personas de una vez), `reservar`, `verReserva` y `cancelar` (estas dos con el código de 64 caracteres de la reserva).
- `public.panel(p jsonb)`: la usa el panel y exige sesión de un email que esté en `pzb.personal`.
  - Equipo y administración: `yo`, `datos`, `guardarReserva`, `cambiarEstado`, `sugerirMesa`.
  - Solo administración: `auditoria`, `guardarServicios`, `guardarMesas`, `guardarApertura`, `guardarConfig`, `importarClientes`, `importarReservas`.

Estados de una reserva: Pendiente, Confirmada, Sentados, Finalizada, Cancelada, No presentado. Las activas son Pendiente, Confirmada y Sentados.

El inicio de `schema.sql` tiene un bloque «LIMPIEZA DEL CORREO» que retira, de forma repetible, lo que quedara de la época de los correos (trabajo de `pg_cron`, funciones, tabla `secretos`, columna `recordatorio` y ajustes de correo de `config`). Las extensiones `pg_net` y `pg_cron` se dejan instaladas sin uso.

## Reglas de negocio

- **Horario:** cenas de miércoles a domingo, a horas fijas (20:00 a 22:30, cada 30 min, editables en el panel). Comidas configuradas para sábado y domingo, pero desactivadas por ahora. Duración de la mesa: 90 min. Máximo de 40 personas con reserva a la vez por servicio.
- **Días especiales** (cerrar o abrir un servicio un día concreto): tabla `aperturas`, que manda sobre el horario normal.
- **Mesa automática:** de las mesas libres durante toda la duración, la más ajustada al grupo, respetando el mínimo de cada mesa. Si empatan, mesa suelta antes que unión y la de mínimo más alto. Uniones definidas en `grupo` (06+07 con 10 plazas, 11+12, 13+14).
- **Reservas web:** se confirman al momento. Piden nombre, apellidos y teléfono (sin correo). Máximo 10 personas y hasta 60 días de antelación. Si es para hoy, al menos 60 minutos antes. Misma reserva repetida = mismo teléfono (últimos 9 dígitos), día y hora activa: se rechaza.
- **Cancelar:** al confirmar, la pantalla muestra el enlace de cancelación (con copiar) y el teléfono del local (el de Personalización). **El código de cancelación solo se devuelve a quien acaba de reservar; nunca se devuelve en una reserva repetida**, porque con él se cancela y un teléfono no es un secreto. Quien no tenga el enlace llama y el equipo cancela desde el panel. Un cliente web cancelado aparece en el panel y en el Historial («Cancelada por el cliente»); no hay aviso aparte.
- **Panel:** se puede forzar una mesa ocupada o pasar de la capacidad. Avisa antes y pide confirmación. El correo en la reserva del panel es un dato opcional de la ficha.
- **Clientes:** ficha por correo, o por teléfono si no tiene correo (los clientes de la web nueva quedan por teléfono). Se importan desde el panel (Clientes → Importar de Vento) con el CSV de Vento (1.310 fichas, que quedan en 1.288 al unir las repetidas). El nº de reservas de Vento se suma a las reservas nuevas de la app.

## Acceso al panel

Usuarios de Supabase Auth (Authentication → Users):
- `equipo@pizzburger.app`: reservas, plano y clientes.
- `admin@pizzburger.app`: todo.

El registro de usuarios nuevos debe estar **desactivado**.

## Secretos (en GitHub → Settings → Secrets and variables → Actions)

Solo `SUPABASE_DB_URL` (Session pooler; la contraseña, sin símbolos).

**Seguridad:**
- Las claves y contraseñas nunca se pegan en el chat ni se suben al repositorio, que es público. Las pone Ander directamente en GitHub o en Supabase.
- Claude no escribe contraseñas ni tokens en ninguna web.
- La URL y la clave *anon* de `config.js` son públicas por diseño.

## Cómo trabajar con Claude

1. Ander describe el cambio («en el panel, en Plano, quiero…»), con una captura si es visual.
2. Claude cambia el código en el repositorio, lo prueba (Postgres local y navegador) y lo sube a `main`.
3. GitHub publica solo la web (1 minuto) y, si cambia `supabase/`, la base de datos.
4. Ander recarga la página para verlo.

Preferencias de Ander:
- Explicaciones en español, sin tecnicismos, con pasos numerados y concretos.
- Quiere que Claude lo haga todo y que él solo tenga que hacer lo imprescindible.
- La app tiene que «funcionar sola», sin depender de una persona.
- Antes de cambiar la estructura de los datos, preguntar.

## Estado (3 de noviembre de 2026)

Hecho:
- Base de datos creada en Supabase (14 mesas, horarios y días especiales de Vento).
- Web y panel publicados sobre Supabase.
- Calendario grande con las reservas de cada día, plano con las reservas sobre cada mesa e importación de clientes.
- Correo eliminado del todo (web, panel, base de datos, función y acción de GitHub). Probado en Postgres local (base nueva y actualizada desde la antigua) y en navegador.

Pendiente (lo hace Ander):
1. Borrar de GitHub → Settings → Secrets → Actions los secretos que ya no se usan: `CLAVE_CORREO`, `GMAIL_APP_PASSWORD` y `SUPABASE_ACCESS_TOKEN`. Revocar ese token en Supabase → Account → Access Tokens. En Supabase → Edge Functions, si aparece `correo`, borrarla. Opcional: quitar la contraseña de aplicación en la cuenta de Gmail.
2. Crear en Supabase los usuarios `equipo@` y `admin@` (marcando *Auto Confirm User*) y desactivar «Allow new users to sign up».
3. En el panel → Personalización: poner el teléfono del local (es el que ve el cliente al confirmar y al cancelar).
4. En el panel → Clientes → Importar de Vento: subir el CSV de fichas de clientes. Opcional: el CSV de reservas antiguas.
5. Limpieza: borrar en GitHub → Actions las ejecuciones fallidas de «Supabase» y la rama `prueba-permisos`. Borrar el proyecto antiguo de Apps Script y la hoja de Google de reservas, que ya no se usan.

Ideas para más adelante: textos legales (condiciones y privacidad), activar las comidas de fin de semana, enlazar la reserva desde la web nueva de Pizzburger.
