// Textos y diseño de los correos de reservas (sin dependencias, se puede probar aparte).

export type Reserva = {
  id?: string; fecha?: string; hora?: string; personas?: number | string; mesa?: string;
  nombre?: string; apellidos?: string; email?: string; telefono?: string; alergias?: string; codigo?: string;
};
export type Config = Record<string, string>;
export type Correo = { para: string; asunto: string; html: string; responderA: string };

const TZ = 'Europe/Madrid';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

export function fechaLarga(f?: string): string {
  const p = String(f ?? '').split('-').map(Number);
  if (p.length < 3 || !p[0]) return String(f ?? '');
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return `${DIAS[d.getUTCDay()]} ${p[2]} de ${MESES[p[1] - 1]}`;
}

function detalles(r: Reserva): string {
  const fila = (k: string, v: unknown) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#777">${k}</td><td style="padding:6px 0;font-weight:600">${esc(v)}</td></tr>`;
  return '<table style="border-collapse:collapse;margin:14px 0;font-size:15px">' +
    fila('Día', fechaLarga(r.fecha)) + fila('Hora', r.hora) + fila('Personas', r.personas) +
    (r.alergias ? fila('Alergias / notas', r.alergias) : '') + '</table>';
}

function datosCliente(r: Reserva): string {
  return `<p style="font-size:14px;color:#555">${esc(`${r.nombre ?? ''} ${r.apellidos ?? ''}`.trim())}<br>${esc(r.telefono)}<br>${esc(r.email)}<br>Mesa: ${esc(r.mesa || 'sin asignar')}</p>`;
}

function boton(href: string, txt: string, fondo: string, color: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;border-radius:7px;background:${fondo};color:${color};text-decoration:none;font-weight:600;font-size:14px">${txt}</a>`;
}

function enlaces(r: Reserva, c: Config): string {
  if (!r.fecha || !r.hora) return '';
  const p = r.fecha.split('-'), h = r.hora.split(':');
  const ini = `${p.join('')}T${h[0]}${h[1]}00`;
  const finMin = Number(h[0]) * 60 + Number(h[1]) + 90;
  const fin = `${p.join('')}T${String(Math.floor(finMin / 60) % 24).padStart(2, '0')}${String(finMin % 60).padStart(2, '0')}00`;
  const cal = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent('Reserva en ' + (c.nombre || 'Pizzburger')) +
    '&dates=' + ini + '/' + (finMin >= 1440 ? ini : fin) + '&ctz=' + encodeURIComponent(TZ) +
    '&details=' + encodeURIComponent(`${r.personas} personas`) +
    (c.direccion ? '&location=' + encodeURIComponent(c.direccion) : '');
  let html = '<p>' + boton(cal, 'Añadir al calendario', '#292929', '#fff');
  if (c.urlPublica && r.codigo && r.id) {
    const sep = c.urlPublica.includes('?') ? '&' : '?';
    html += boton(`${c.urlPublica}${sep}cancelar=${encodeURIComponent(r.id)}&codigo=${r.codigo}`, 'Cancelar reserva', '#eee', '#555');
  }
  html += '</p>';
  if (c.telefono) html += `<p style="font-size:13px;color:#777">¿Algún cambio? Llámanos al ${esc(c.telefono)}.</p>`;
  return html;
}

function plantilla(c: Config, titulo: string, cuerpo: string): string {
  const nombre = c.nombre || 'Pizzburger';
  const logo = /^https:\/\//.test(c.logo || '') ? `<img src="${esc(c.logo)}" alt="" style="max-height:56px;margin-bottom:8px"><br>` : '';
  return '<div style="background:#f4f4f2;padding:24px 12px;font-family:Arial,sans-serif;color:#292929">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:26px 24px">' +
    `${logo}<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#777">${esc(nombre)}</div>` +
    `<h1 style="font-size:22px;margin:6px 0 14px">${esc(titulo)}</h1>${cuerpo}` +
    `</div><p style="text-align:center;font-size:11px;color:#999;margin-top:14px">${esc(nombre)}${c.direccion ? ' · ' + esc(c.direccion) : ''}</p></div>`;
}

/** Devuelve el correo a enviar, o null si no hay destinatario / tipo desconocido. */
export function construir(tipo: string, r: Reserva, c: Config): Correo | null {
  const nombre = c.nombre || 'Pizzburger';
  const alRestaurante = tipo.startsWith('aviso_') || tipo === 'prueba';
  const para = alRestaurante ? (c.emailRestaurante || '') : (r.email || '');
  if (!para) return null;
  const hola = `<p>Hola ${esc(r.nombre)},</p>`;
  const det = detalles(r);
  let asunto: string, cuerpo: string;
  switch (tipo) {
    case 'confirmacion':
      asunto = c.asuntoConfirmacion || `Reserva confirmada · ${nombre}`;
      cuerpo = hola + `<p>${esc(c.textoConfirmacion || 'Tu reserva está confirmada. ¡Te esperamos!')}</p>` + det + enlaces(r, c);
      break;
    case 'modificacion':
      asunto = `Reserva modificada · ${nombre}`;
      cuerpo = hola + '<p>Hemos actualizado tu reserva. Estos son los datos nuevos:</p>' + det + enlaces(r, c);
      break;
    case 'recordatorio':
      asunto = `Recordatorio de tu reserva · ${nombre}`;
      cuerpo = hola + `<p>${esc(c.textoRecordatorio || 'Te recordamos tu próxima reserva.')}</p>` + det + enlaces(r, c);
      break;
    case 'cancelacion':
      asunto = `Reserva cancelada · ${nombre}`;
      cuerpo = hola + '<p>Tu reserva ha quedado cancelada.</p>' + det +
        `<p>Si ha sido un error o quieres otra fecha, puedes volver a reservar${c.urlPublica ? ` <a href="${esc(c.urlPublica)}">aquí</a>` : ''}.</p>`;
      break;
    case 'aviso_nueva':
      asunto = `Nueva reserva web: ${r.nombre} · ${fechaLarga(r.fecha)} ${r.hora} · ${r.personas} pax`;
      cuerpo = '<p>Ha entrado una reserva desde la web.</p>' + det + datosCliente(r);
      break;
    case 'aviso_cancelacion':
      asunto = `Cancelación: ${r.nombre} · ${fechaLarga(r.fecha)} ${r.hora}`;
      cuerpo = '<p>El cliente ha cancelado su reserva desde el enlace del correo.</p>' + det + datosCliente(r);
      break;
    case 'prueba':
      asunto = `Prueba · Reservas ${nombre}`;
      cuerpo = '<p>Si ves esto, los correos de las reservas funcionan.</p>';
      break;
    default:
      return null;
  }
  return {
    para, asunto, html: plantilla(c, asunto, cuerpo),
    responderA: alRestaurante ? (r.email || c.emailRestaurante || '') : (c.emailRestaurante || ''),
  };
}
