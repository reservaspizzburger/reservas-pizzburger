# Reservas Pizzburger

App de reservas propia: página pública para clientes + panel interno, sobre **Google Sheets + Apps Script** (mismo sistema que la app de cocina). Sustituye a la versión de Vento; no depende de Vento para nada.

## Archivos

| Archivo | Qué es | Dónde va |
|---|---|---|
| `apps-script-reservas.gs` | Servidor: horarios, mesas, reservas, correos, recordatorios, PIN | Apps Script de la hoja «Reservas Pizzburger» |
| `index.html` | Página pública donde reserva el cliente | GitHub Pages (raíz del repositorio) |
| `admin.html` | Panel del equipo | GitHub Pages (`/admin.html`) |

## Base de datos (pestañas de la hoja)

Se crean solas al ejecutar `instalar()`, ya rellenas con los datos exportados de Vento (14 mesas, servicios y días especiales).

- **RESERVAS**: una fila por reserva. `codigo` es el código secreto del enlace de cancelar (no se envía nunca al panel).
- **MESAS**: `mesa, activa, capacidad, minimo, forma, x, y, zona, grupo, capacidadGrupo`. `grupo` = mesas que se pueden juntar (`06+07`); `capacidadGrupo` = plazas juntas (si se deja vacío, suma las de cada mesa).
- **SERVICIOS**: `servicio, activo, dias, horas, duracion, capacidad`. `dias`: 0 = domingo … 6 = sábado. `horas`: horas fijas que se ofrecen en la web.
- **APERTURAS**: días que se salen del horario normal (`fecha, comidas, cenas` con si/no). Una columna por servicio, con su nombre en minúsculas.
- **CLIENTES**: clientes importados de Vento (nº de reservas, primera y última visita, notas). Se rellena desde el panel: Clientes → «Importar de Vento».
- **CONFIG**: nombre, logo, textos de correo, textos legales, reglas de antelación, etc.
- **AUDITORIA**: historial de cambios.

Se puede editar a mano en la hoja, pero lo normal es hacerlo desde el panel (Configuración).

## Instalación (una vez)

1. Crea una hoja de Google nueva llamada **Reservas Pizzburger** con la cuenta que enviará los correos (recomendado: `reservaspizzburger@gmail.com`).
2. Extensiones → Apps Script → borra lo que haya y pega `apps-script-reservas.gs`.
3. Arriba del script, escribe tus PIN en `PIN_EQUIPO_NUEVO` (equipo) y `PIN_ADMIN_NUEVO` (administración). Tienen que ser distintos.
4. Elige la función `instalar` y pulsa **Ejecutar**. Acepta los permisos (hoja, Gmail, activadores).
5. **Borra los PIN del código** (deja `''`). Ya quedan guardados en privado en Propiedades del script.
6. Implementar → Nueva implementación → tipo **Aplicación web** → Ejecutar como: **Yo** · Acceso: **Cualquier usuario** → copia la URL que termina en `/exec`.
7. En los dos `.html`, cambia `PEGAR_AQUI_LA_URL_DEL_APPS_SCRIPT` por esa URL y súbelos a tu hosting.
8. Entra al panel con el PIN de administración → Personalización → rellena **teléfono** y **dirección de la página pública** (sin ella, el correo no lleva botón de «Cancelar reserva») → Guardar → «Enviar correo de prueba».

Si cambias el `.gs` más adelante: Implementar → Gestionar implementaciones → editar → **Nueva versión** (así la URL no cambia).

Cambiar PIN más tarde: rellena las constantes, ejecuta `cambiarPines()` y vuelve a vaciarlas.

## Cómo funciona

**Horas y mesas.** Para cada hora fija del servicio, la web solo la ofrece si:
1. Ese día el servicio está abierto (APERTURAS manda sobre el horario normal).
2. Con el grupo nuevo no se supera el máximo de personas con reserva a la vez (`capacidad` del servicio).
3. Hay una mesa libre durante toda la duración (`duracion`, 90 min por defecto). La app elige la más ajustada al grupo, respetando el `minimo` de cada mesa. Si empatan, prefiere la mesa suelta y la de mínimo más alto. Si no hay ninguna suelta, usa una unión (06+07…).

Hoy además oculta las horas que empiezan antes de `minutosAntelacion` (60 min).

**Reservas web**: se confirman al momento. El script lo vuelve a comprobar todo con bloqueo, así que dos clientes no pueden coger la misma mesa a la vez. Al confirmar, el cliente recibe un correo con «Añadir al calendario» y «Cancelar reserva», y el restaurante recibe un aviso.

**Panel**:
- **PIN de equipo**: Reservas (llegadas, no presentados, finalizar, editar, nueva reserva por teléfono), Plano y Clientes.
- **PIN de administración**: todo lo anterior, más Aperturas y cierres, Servicios y horas, Mesas, Personalización, Estadísticas e Historial.

Los permisos se comprueban en el servidor; la sesión dura 6 h desde el último uso. Desde el panel se puede forzar una mesa ocupada o pasar de la capacidad: avisa y pide confirmación.

**Correos**: confirmación, modificación (si cambia día, hora o personas y está marcado «Enviar correo al cliente»), cancelación (desde el enlace o desde el panel) y recordatorio unas 2 h antes (activador cada 15 min). Una cuenta Gmail normal tiene unos 100 correos al día.

## Pasar clientes y reservas de Vento

Desde el panel, con el PIN de administración: **Clientes → Importar de Vento**.
1. Exporta de Vento `clientes_restaurante` a CSV y elígelo en «1. Clientes».
2. (Opcional) Exporta `reservas_restaurante` a CSV y elígelo en «2. Reservas antiguas», para ver el detalle de cada visita.

Se puede repetir sin duplicar nada: los clientes se unen por correo, o por teléfono si no tienen correo. El nº de reservas que traía Vento se suma a las reservas nuevas de la app.

## Cosas a tener en cuenta

- **Textos legales**: la página pública enlaza a condiciones y privacidad. Están vacíos hasta que los rellenes en Personalización.
- **Copias de seguridad**: no hay módulo propio. La hoja de Google guarda su historial de versiones (Archivo → Historial de versiones).
- **Cerrar un día con reservas no las cancela**: el panel avisa, y hay que llamar o cancelar una por una.
