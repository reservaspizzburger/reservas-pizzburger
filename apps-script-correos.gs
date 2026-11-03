/**
 * ============================================================
 *  RESERVAS PIZZBURGER — Envío de correos (Google Apps Script)
 * ============================================================
 *  Las reservas ya viven en Supabase. Este script SOLO envía los
 *  correos (confirmación, recordatorio, cambios, cancelación y avisos
 *  al restaurante) desde la cuenta de Gmail del restaurante.
 *  Supabase le llama cada vez que hay que mandar uno.
 *
 *  Instalación (una vez):
 *    1. Pega este código en Apps Script (sustituye todo lo anterior).
 *    2. Escribe en CLAVE la misma clave que el secreto CLAVE_CORREO de GitHub.
 *    3. Ejecuta probarCorreo() y acepta los permisos de Gmail.
 *    4. Implementar → Gestionar implementaciones → ✏️ → Nueva versión.
 * ============================================================
 */

const CLAVE = 'PEGAR_AQUI_LA_CLAVE_CORREO';
const TZ = 'Europe/Madrid';
const VERSION_CORREOS = '2.0';

function doGet() {
  return salida_({ ok: true, app: 'Correos Reservas Pizzburger', version: VERSION_CORREOS });
}

function doPost(e) {
  let d = {};
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return salida_({ ok: false, error: 'Petición no válida' }); }
  if (!CLAVE || CLAVE.indexOf('PEGAR_') === 0 || d.clave !== CLAVE) return salida_({ ok: false, error: 'Clave incorrecta' });
  const ok = enviarCorreo_(String(d.tipo || ''), d.reserva || {}, d.config || {});
  return salida_({ ok: ok });
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecuta esto una vez para dar permiso a Gmail y comprobar que llega. */
function probarCorreo() {
  const para = Session.getEffectiveUser().getEmail();
  const ok = enviarCorreo_('prueba', { email: para, nombre: 'Prueba', fecha: hoy_(), hora: '21:00', personas: 2 },
    { nombre: 'Pizzburger', emailRestaurante: para });
  console.log(ok ? 'Correo de prueba enviado a ' + para : 'No se pudo enviar');
  console.log('Correos que quedan hoy: ' + MailApp.getRemainingDailyQuota());
}

function enviarCorreo_(tipo, r, c) {
  try {
    c = Object.assign({ nombre: 'Pizzburger', emailRestaurante: '' }, c);
    if (MailApp.getRemainingDailyQuota() < 1) { console.warn('Sin cupo de correos hoy'); return false; }
    const alRestaurante = tipo.indexOf('aviso_') === 0 || tipo === 'prueba';
    const para = alRestaurante ? c.emailRestaurante : r.email;
    if (!para) return false;
    const nombre = esc_(r.nombre);
    const det = detalles_(r);
    const enlaces = enlacesCliente_(r, c);
    let asunto, cuerpo;
    switch (tipo) {
      case 'confirmacion':
        asunto = c.asuntoConfirmacion || ('Reserva confirmada · ' + c.nombre);
        cuerpo = '<p>Hola ' + nombre + ',</p><p>' + esc_(c.textoConfirmacion || 'Tu reserva está confirmada. ¡Te esperamos!') + '</p>' + det + enlaces;
        break;
      case 'modificacion':
        asunto = 'Reserva modificada · ' + c.nombre;
        cuerpo = '<p>Hola ' + nombre + ',</p><p>Hemos actualizado tu reserva. Estos son los datos nuevos:</p>' + det + enlaces;
        break;
      case 'recordatorio':
        asunto = 'Recordatorio de tu reserva · ' + c.nombre;
        cuerpo = '<p>Hola ' + nombre + ',</p><p>' + esc_(c.textoRecordatorio || 'Te recordamos tu próxima reserva.') + '</p>' + det + enlaces;
        break;
      case 'cancelacion':
        asunto = 'Reserva cancelada · ' + c.nombre;
        cuerpo = '<p>Hola ' + nombre + ',</p><p>Tu reserva ha quedado cancelada.</p>' + det +
          '<p>Si ha sido un error o quieres otra fecha, puedes volver a reservar' +
          (c.urlPublica ? ' <a href="' + esc_(c.urlPublica) + '">aquí</a>' : '') + '.</p>';
        break;
      case 'aviso_nueva':
        asunto = 'Nueva reserva web: ' + r.nombre + ' · ' + fechaLarga_(r.fecha) + ' ' + r.hora + ' · ' + r.personas + ' pax';
        cuerpo = '<p>Ha entrado una reserva desde la web.</p>' + det + datosCliente_(r);
        break;
      case 'aviso_cancelacion':
        asunto = 'Cancelación: ' + r.nombre + ' · ' + fechaLarga_(r.fecha) + ' ' + r.hora;
        cuerpo = '<p>El cliente ha cancelado su reserva desde el enlace del correo.</p>' + det + datosCliente_(r);
        break;
      case 'prueba':
        asunto = 'Prueba · Reservas ' + c.nombre;
        cuerpo = '<p>Si ves esto, los correos de las reservas funcionan.</p>';
        break;
      default: return false;
    }
    MailApp.sendEmail({
      to: para, subject: asunto, htmlBody: plantilla_(c, asunto, cuerpo), name: c.nombre,
      replyTo: alRestaurante ? (r.email || c.emailRestaurante) : (c.emailRestaurante || undefined)
    });
    return true;
  } catch (e) {
    console.error('Correo ' + tipo + ' falló: ' + e);
    return false;
  }
}

function detalles_(r) {
  const fila = function (k, v) {
    return '<tr><td style="padding:6px 14px 6px 0;color:#777">' + k + '</td><td style="padding:6px 0;font-weight:600">' + esc_(v) + '</td></tr>';
  };
  return '<table style="border-collapse:collapse;margin:14px 0;font-size:15px">' +
    fila('Día', fechaLarga_(r.fecha)) + fila('Hora', r.hora) + fila('Personas', String(r.personas)) +
    (r.alergias ? fila('Alergias / notas', r.alergias) : '') + '</table>';
}

function datosCliente_(r) {
  return '<p style="font-size:14px;color:#555">' + esc_((String(r.nombre || '') + ' ' + String(r.apellidos || '')).trim()) +
    '<br>' + esc_(r.telefono || '') + '<br>' + esc_(r.email || '') + '<br>Mesa: ' + esc_(r.mesa || 'sin asignar') + '</p>';
}

function enlacesCliente_(r, c) {
  if (!r.fecha || !r.hora) return '';
  const p = String(r.fecha).split('-'), h = String(r.hora).split(':');
  const ini = p.join('') + 'T' + h[0] + h[1] + '00';
  const finMin = Number(h[0]) * 60 + Number(h[1]) + 90;
  const fin = p.join('') + 'T' + ('0' + Math.floor(finMin / 60) % 24).slice(-2) + ('0' + finMin % 60).slice(-2) + '00';
  const cal = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent('Reserva en ' + c.nombre) +
    '&dates=' + ini + '/' + (finMin >= 1440 ? ini : fin) + '&ctz=' + encodeURIComponent(TZ) +
    '&details=' + encodeURIComponent(r.personas + ' personas') +
    (c.direccion ? '&location=' + encodeURIComponent(c.direccion) : '');
  const boton = function (href, txt, fondo, color) {
    return '<a href="' + href + '" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;border-radius:7px;background:' +
      fondo + ';color:' + color + ';text-decoration:none;font-weight:600;font-size:14px">' + txt + '</a>';
  };
  let html = '<p>' + boton(cal, 'Añadir al calendario', '#292929', '#fff');
  if (c.urlPublica && r.codigo && r.id) {
    const sep = c.urlPublica.indexOf('?') >= 0 ? '&' : '?';
    html += boton(c.urlPublica + sep + 'cancelar=' + encodeURIComponent(r.id) + '&codigo=' + r.codigo, 'Cancelar reserva', '#eee', '#555');
  }
  html += '</p>';
  if (c.telefono) html += '<p style="font-size:13px;color:#777">¿Algún cambio? Llámanos al ' + esc_(c.telefono) + '.</p>';
  return html;
}

function plantilla_(c, titulo, cuerpo) {
  const logo = /^https:\/\//.test(c.logo || '') ? '<img src="' + esc_(c.logo) + '" alt="" style="max-height:56px;margin-bottom:8px"><br>' : '';
  return '<div style="background:#f4f4f2;padding:24px 12px;font-family:Arial,sans-serif;color:#292929">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:26px 24px;box-shadow:0 8px 24px #0000000d">' +
    logo + '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#777">' + esc_(c.nombre) + '</div>' +
    '<h1 style="font-size:22px;margin:6px 0 14px">' + esc_(titulo) + '</h1>' + cuerpo +
    '</div><p style="text-align:center;font-size:11px;color:#999;margin-top:14px">' + esc_(c.nombre) +
    (c.direccion ? ' · ' + esc_(c.direccion) : '') + '</p></div>';
}

function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function fechaLarga_(f) {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const p = String(f || '').split('-').map(Number);
  if (p.length < 3 || !p[0]) return String(f || '');
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return dias[d.getUTCDay()] + ' ' + p[2] + ' de ' + meses[p[1] - 1];
}

function esc_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
