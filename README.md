# Reservas Pizzburger

App de reservas propia: página pública para clientes y panel interno.

- **Clientes:** https://reservaspizzburger.github.io/reservas-pizzburger/
- **Panel:** https://reservaspizzburger.github.io/reservas-pizzburger/admin.html

## Cómo está montada

| Pieza | Dónde vive | Se actualiza |
|---|---|---|
| `index.html`, `admin.html`, `config.js` | GitHub Pages | Solo, al subir cambios a `main` |
| `supabase/schema.sql` (base de datos y toda la lógica) | Supabase | Solo, con la acción «Supabase» de GitHub |

**La app no envía correos.** No hay dominio, ni Resend, ni Gmail. El cliente, al reservar, ve en pantalla su enlace para cancelar y el teléfono del local.

**Base de datos (Supabase, esquema privado `pzb`):** reservas, mesas, servicios, aperturas, config, clientes, auditoria y personal. Desde la web solo se puede llamar a dos funciones:
- `publico(p)`: la página de reservas (horarios, reservar, ver y cancelar con el código de la reserva).
- `panel(p)`: el panel. Exige haber iniciado sesión con un usuario de la tabla `personal`.

**Acceso al panel:** usuarios de Supabase Auth.
- `equipo@pizzburger.app`: reservas, plano y clientes.
- `admin@pizzburger.app`: además, toda la configuración, las estadísticas y las importaciones.

Las contraseñas se cambian en Supabase → Authentication → Users. El registro de usuarios nuevos tiene que estar desactivado.

## Secreto de GitHub (Settings → Secrets and variables → Actions)

- `SUPABASE_DB_URL`: cadena «Session pooler» de Supabase (Connect). La contraseña debe ir sin símbolos como @ / # :, o codificada.

No hace falta ningún otro.

## Cómo funciona la disponibilidad

Para cada hora fija de un servicio, la web solo la ofrece si se cumplen tres condiciones:
1. Ese día está abierto. Un día cambiado en «Aperturas y cierres» manda sobre el horario normal.
2. No se supera el máximo de personas con reserva a la vez.
3. Hay una mesa libre durante toda la duración. Se elige la más ajustada al grupo, respetando el mínimo de cada mesa. Si no hay ninguna mesa suelta que encaje, se usa una unión (06+07…).

## Cancelar una reserva

Al confirmar, la web devuelve el código secreto de la reserva (64 caracteres) y lo muestra como enlace `?cancelar=ID&codigo=…`. Ese código solo se entrega a quien acaba de reservar; si alguien repite una reserva con el mismo teléfono, día y hora, la web la rechaza **sin** devolver ningún código. Quien no tenga el enlace llama al local y el equipo cancela desde el panel.

## Clientes de Vento

Panel (administración) → Clientes → **Importar de Vento**: CSV de fichas de clientes y, si se quiere, CSV de reservas antiguas. Acepta el formato de Vento (`tel_prefijo`, `tel_movil`, fechas dd/mm/aaaa, tildes en Latin-1) y une las fichas repetidas. Se puede repetir sin duplicar.
