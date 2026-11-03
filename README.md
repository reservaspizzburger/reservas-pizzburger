# Reservas Pizzburger

App de reservas propia: página pública para clientes y panel interno.

- **Clientes:** https://reservaspizzburger.github.io/reservas-pizzburger/
- **Panel:** https://reservaspizzburger.github.io/reservas-pizzburger/admin.html

## Cómo está montada

| Pieza | Dónde vive | Se actualiza |
|---|---|---|
| `index.html`, `admin.html`, `config.js` | GitHub Pages | Solo, al subir cambios a `main` |
| `supabase/schema.sql` (base de datos y toda la lógica) | Supabase | Solo, con la acción «Supabase» de GitHub |
| `supabase/functions/correo` (envío de correos desde Gmail) | Supabase Edge Functions | Solo, con la acción «Supabase» de GitHub |

**Base de datos (Supabase, esquema privado `pzb`):** reservas, mesas, servicios, aperturas, config, clientes, auditoria, personal y secretos. Desde la web solo se puede llamar a dos funciones:
- `publico(p)`: la página de reservas (horarios, reservar, ver y cancelar con el código del correo).
- `panel(p)`: el panel. Exige haber iniciado sesión con un usuario de la tabla `personal`.

**Acceso al panel:** usuarios de Supabase Auth.
- `equipo@pizzburger.app`: reservas, plano y clientes.
- `admin@pizzburger.app`: además, toda la configuración, las estadísticas y las importaciones.

Las contraseñas se cambian en Supabase → Authentication → Users. El registro de usuarios nuevos tiene que estar desactivado.

**Correos:** la base de datos los encarga con `pg_net` a la función `correo`, que los envía por Gmail (smtp.gmail.com:465) con una contraseña de aplicación. Los recordatorios (~2 h antes) los lanza `pg_cron` cada 15 minutos.

## Secretos de GitHub (Settings → Secrets and variables → Actions)

- `SUPABASE_DB_URL`: cadena «Session pooler» de Supabase (Connect). La contraseña debe ir sin símbolos como @ / # :, o codificada.
- `CLAVE_CORREO`: clave compartida entre la base de datos y la función de correos.
- `SUPABASE_ACCESS_TOKEN`: token personal de Supabase (Account → Access Tokens), para publicar la función.
- `GMAIL_APP_PASSWORD`: contraseña de aplicación de reservaspizzburger@gmail.com (Cuenta de Google → Seguridad → Contraseñas de aplicaciones).

## Cómo funciona la disponibilidad

Para cada hora fija de un servicio, la web solo la ofrece si se cumplen tres condiciones:
1. Ese día está abierto. Un día cambiado en «Aperturas y cierres» manda sobre el horario normal.
2. No se supera el máximo de personas con reserva a la vez.
3. Hay una mesa libre durante toda la duración. Se elige la más ajustada al grupo, respetando el mínimo de cada mesa. Si no hay ninguna mesa suelta que encaje, se usa una unión (06+07…).

## Clientes de Vento

Panel (administración) → Clientes → **Importar de Vento**: CSV de fichas de clientes y, si se quiere, CSV de reservas antiguas. Acepta el formato de Vento (`tel_prefijo`, `tel_movil`, fechas dd/mm/aaaa, tildes en Latin-1) y une las fichas repetidas. Se puede repetir sin duplicar.
