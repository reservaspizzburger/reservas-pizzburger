/**
 * ============================================================
 *  RESERVAS PIZZBURGER — Backend (Google Apps Script)
 * ============================================================
 *  Base de datos: la propia hoja de Google donde vive este script.
 *  Pestañas: RESERVAS, MESAS, SERVICIOS, APERTURAS, CONFIG, AUDITORIA
 *
 *  Instalación (ver README.md):
 *    1. Pon tus PIN en PIN_EQUIPO_NUEVO / PIN_ADMIN_NUEVO (abajo).
 *    2. Ejecuta instalar() una vez y acepta los permisos.
 *    3. Borra los PIN de abajo (ya quedan guardados en privado).
 *    4. Implementar → Nueva implementación → Aplicación web
 *       (Ejecutar como: Yo · Acceso: Cualquier usuario).
 *    5. Pega la URL /exec en API_URL de los dos .html.
 * ============================================================
 */

const VERSION = '1.0';
const TZ = 'Europe/Madrid';

// Rellena solo para instalar o cambiar los PIN; después déjalos vacíos.
const PIN_EQUIPO_NUEVO = '';   // PIN del equipo: reservas, plano y clientes
const PIN_ADMIN_NUEVO = '';    // PIN de administración: además, configuración

const HOJAS = {
  RESERVAS: 'RESERVAS', MESAS: 'MESAS', SERVICIOS: 'SERVICIOS',
  APERTURAS: 'APERTURAS', CONFIG: 'CONFIG', AUDITORIA: 'AUDITORIA', CLIENTES: 'CLIENTES'
};

const COLUMNAS = {
  RESERVAS: ['id', 'creada', 'actualizada', 'fecha', 'hora', 'servicio', 'personas', 'mesa',
    'nombre', 'apellidos', 'email', 'telefono', 'alergias', 'notas', 'estado', 'origen',
    'codigo', 'recordatorio'],
  MESAS: ['mesa', 'activa', 'capacidad', 'minimo', 'forma', 'x', 'y', 'zona', 'grupo', 'capacidadGrupo'],
  SERVICIOS: ['servicio', 'activo', 'dias', 'horas', 'duracion', 'capacidad'],
  APERTURAS: ['fecha', 'comidas', 'cenas'],
  CONFIG: ['clave', 'valor'],
  AUDITORIA: ['fecha', 'reserva', 'accion', 'antes', 'despues', 'origen'],
  CLIENTES: ['clave', 'nombre', 'apellidos', 'email', 'telefono', 'telefono2', 'primera', 'ultima', 'reservas', 'personas', 'noVino', 'suscrito', 'empresa', 'notas', 'origen']
};

const ESTADOS = ['Pendiente', 'Confirmada', 'Sentados', 'Finalizada', 'Cancelada', 'No presentado'];
const ACTIVAS = ['Pendiente', 'Confirmada', 'Sentados'];

const CONFIG_DEF = {
  nombre: 'Pizzburger',
  subtitulo: 'Elige cuándo quieres venir',
  logo: '',
  telefono: '',
  direccion: 'Trujillo',
  emailRestaurante: 'reservaspizzburger@gmail.com',
  urlPublica: '',
  asuntoConfirmacion: 'Reserva confirmada · Pizzburger',
  textoConfirmacion: 'Tu reserva está confirmada. ¡Te esperamos!',
  textoRecordatorio: 'Te recordamos tu próxima reserva.',
  condiciones: '',
  privacidad: '',
  diasAntelacion: '60',
  minutosAntelacion: '60',
  maxPersonasWeb: '10',
  avisarRestaurante: 'si'
};

// Datos iniciales (exportados de Vento el 3/11/2026)
const MESAS_INICIALES = [
  ['01', 'si', 5, 4, 'rectangular', 8, 8, 'sala', '', ''],
  ['02', 'si', 9, 4, 'rectangular', 8, 29, 'sala', '', ''],
  ['03', 'si', 2, 1, 'rectangular', 8, 50, 'sala', '', ''],
  ['04', 'si', 9, 6, 'rectangular', 8, 71, 'sala', '', ''],
  ['05', 'si', 2, 1, 'redonda', 44, 50, 'sala', '', ''],
  ['06', 'si', 5, 1, 'redonda', 63, 50, 'sala', '06+07', 10],
  ['07', 'si', 5, 1, 'redonda', 79, 50, 'sala', '06+07', 10],
  ['08', 'si', 2, 1, 'redonda', 62, 75, 'sala', '', ''],
  ['09', 'si', 5, 5, 'redonda', 81, 74, 'sala', '', ''],
  ['10', 'si', 4, 3, 'redonda', 77, 8, 'sala', '', ''],
  ['11', 'si', 2, 1, 'rectangular', 57, 29, 'sala', '11+12', ''],
  ['12', 'si', 2, 1, 'rectangular', 68, 29, 'sala', '11+12', ''],
  ['13', 'si', 2, 1, 'rectangular', 79, 29, 'sala', '13+14', ''],
  ['14', 'si', 2, 1, 'rectangular', 90, 29, 'sala', '13+14', '']
];
const SERVICIOS_INICIALES = [
  ['Cenas', 'si', '0,3,4,5,6', '20:00, 20:30, 21:00, 21:30, 22:00, 22:30', 90, 40],
  ['Comidas', 'no', '0,6', '13:00, 13:30, 14:00, 14:30, 15:00', 90, 40]
];
const APERTURAS_INICIALES = [
  ['2026-01-05', 'no', 'si'], ['2026-01-06', 'no', 'si'], ['2026-01-07', 'no', 'no'],
  ['2026-01-08', 'no', 'no'], ['2026-06-22', 'no', 'no'], ['2026-10-31', 'si', 'si'],
  ['2026-11-01', 'si', 'si'], ['2026-11-02', 'si', 'si'], ['2026-11-04', 'no', 'no'],
  ['2026-12-05', 'si', 'si'], ['2026-12-06', 'si', 'si'], ['2026-12-07', 'si', 'si'],
  ['2026-12-08', 'si', 'si'], ['2026-12-09', 'no', 'no'], ['2026-12-10', 'no', 'no'],
  ['2026-12-21', 'no', 'si'], ['2026-12-22', 'si', 'no'], ['2026-12-24', 'no', 'no'],
  ['2026-12-28', 'no', 'si'], ['2026-12-29', 'no', 'si'], ['2026-12-31', 'no', 'no'],
  ['2027-01-04', 'no', 'si'], ['2027-01-05', 'no', 'si'], ['2027-01-07', 'no', 'no']
];

/* ============================================================
 *  INSTALACIÓN
 * ============================================================ */

function instalar() {
  const props = PropertiesService.getScriptProperties();
  // Usa la hoja donde está el script; si el script está suelto, usa (o crea) la hoja "Reservas Pizzburger"
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss && props.getProperty('SHEET_ID')) {
    try { ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID')); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Reservas Pizzburger');
    console.log('Hoja creada en tu Google Drive: ' + ss.getUrl());
  }
  props.setProperty('SHEET_ID', ss.getId());
  const hojaVacia = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');

  crearHoja_(ss, HOJAS.RESERVAS, COLUMNAS.RESERVAS, []);
  crearHoja_(ss, HOJAS.MESAS, COLUMNAS.MESAS, MESAS_INICIALES);
  crearHoja_(ss, HOJAS.SERVICIOS, COLUMNAS.SERVICIOS, SERVICIOS_INICIALES);
  crearHoja_(ss, HOJAS.APERTURAS, COLUMNAS.APERTURAS, APERTURAS_INICIALES);
  crearHoja_(ss, HOJAS.CONFIG, COLUMNAS.CONFIG,
    Object.keys(CONFIG_DEF).map(function (k) { return [k, CONFIG_DEF[k]]; }));
  crearHoja_(ss, HOJAS.AUDITORIA, COLUMNAS.AUDITORIA, []);
  crearHoja_(ss, HOJAS.CLIENTES, COLUMNAS.CLIENTES, []);
  if (hojaVacia && hojaVacia.getLastRow() === 0) ss.deleteSheet(hojaVacia);

  // PIN
  if (PIN_EQUIPO_NUEVO) props.setProperty('PIN_EQUIPO', String(PIN_EQUIPO_NUEVO).trim());
  if (PIN_ADMIN_NUEVO) props.setProperty('PIN_ADMIN', String(PIN_ADMIN_NUEVO).trim());
  if (!props.getProperty('PIN_EQUIPO')) {
    props.setProperty('PIN_EQUIPO', String(Math.floor(1000 + Math.random() * 9000)));
    console.log('PIN de equipo generado: ' + props.getProperty('PIN_EQUIPO'));
  }
  if (!props.getProperty('PIN_ADMIN')) {
    props.setProperty('PIN_ADMIN', String(Math.floor(100000 + Math.random() * 900000)));
    console.log('PIN de administración generado: ' + props.getProperty('PIN_ADMIN'));
  }
  if (props.getProperty('PIN_EQUIPO') === props.getProperty('PIN_ADMIN')) {
    throw new Error('El PIN de equipo y el de administración deben ser distintos.');
  }

  // Activador de recordatorios (cada 15 minutos)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'recordatorios') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('recordatorios').timeBased().everyMinutes(15).create();

  CACHEABLES.forEach(invalidar_);
  console.log("Instalado. Hoja: " + ss.getUrl());
  console.log("Cuenta que envía los correos: " + Session.getEffectiveUser().getEmail());
  console.log('Correos restantes hoy: ' + MailApp.getRemainingDailyQuota());
  console.log('Ahora: Implementar → Nueva implementación → Aplicación web.');
}

function crearHoja_(ss, nombre, columnas, filas) {
  let sh = ss.getSheetByName(nombre);
  const nueva = !sh;
  if (!sh) sh = ss.insertSheet(nombre);
  sh.getRange(1, 1, sh.getMaxRows(), Math.max(columnas.length, sh.getMaxColumns())).setNumberFormat('@');
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    // Añade columnas que falten sin tocar las existentes
    const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    columnas.forEach(function (c) {
      if (cab.indexOf(c) < 0) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(c).setFontWeight('bold');
      }
    });
  }
  if ((nueva || sh.getLastRow() < 2) && filas.length) {
    sh.getRange(2, 1, filas.length, columnas.length).setValues(filas.map(function (f) {
      return f.map(function (v) { return v === null || v === undefined ? '' : String(v); });
    }));
  }
}

/** Cambia los PIN sin reinstalar: rellena las constantes de arriba y ejecuta esto. */
function cambiarPines() {
  const props = PropertiesService.getScriptProperties();
  if (PIN_EQUIPO_NUEVO) props.setProperty('PIN_EQUIPO', String(PIN_EQUIPO_NUEVO).trim());
  if (PIN_ADMIN_NUEVO) props.setProperty('PIN_ADMIN', String(PIN_ADMIN_NUEVO).trim());
  console.log('PIN actualizados. Vacía de nuevo las constantes PIN_*_NUEVO.');
}

/** Envía un correo de prueba al correo del restaurante. */
function probarCorreo() {
  const c = config_();
  MailApp.sendEmail({ to: c.emailRestaurante, subject: 'Prueba · Reservas ' + c.nombre,
    htmlBody: plantilla_(c, 'Prueba de correo', '<p>Si ves esto, los correos funcionan.</p>'),
    name: c.nombre });
  console.log('Enviado a ' + c.emailRestaurante);
}

/* ============================================================
 *  API WEB
 * ============================================================ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion) return salida_(despachar_(p));
  return salida_({ ok: true, app: 'Reservas Pizzburger', version: VERSION });
}

function doPost(e) {
  let d = {};
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return salida_({ ok: false, error: 'Petición no válida' }); }
  return salida_(despachar_(d));
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function despachar_(d) {
  try {
    const accion = String(d.accion || '');
    const publicas = {
      servicios: apiServicios_, horarios: apiHorarios_, reservar: apiReservar_,
      verReserva: apiVerReserva_, cancelar: apiCancelarPublica_, login: apiLogin_
    };
    if (publicas[accion]) return publicas[accion](d);

    const privadas = {
      datos: ['equipo', apiDatos_],
      guardarReserva: ['equipo', apiGuardarReserva_],
      cambiarEstado: ['equipo', apiCambiarEstado_],
      sugerirMesa: ['equipo', apiSugerirMesa_],
      salir: ['equipo', apiSalir_],
      auditoria: ['admin', apiAuditoria_],
      guardarServicios: ['admin', apiGuardarServicios_],
      guardarMesas: ['admin', apiGuardarMesas_],
      guardarApertura: ['admin', apiGuardarApertura_],
      guardarConfig: ['admin', apiGuardarConfig_],
      correoPrueba: ['admin', apiCorreoPrueba_],
      importarClientes: ['admin', apiImportarClientes_],
      importarReservas: ['admin', apiImportarReservas_]
    };
    const def = privadas[accion];
    if (!def) return { ok: false, error: 'Acción desconocida' };
    const ses = sesion_(d.token);
    if (!ses) return { ok: false, sesion: false, error: 'Sesión caducada. Vuelve a entrar.' };
    if (def[0] === 'admin' && ses.rol !== 'admin') {
      return { ok: false, error: 'Esta opción necesita el PIN de administración.' };
    }
    return def[1](d, ses);
  } catch (err) {
    console.error(err && err.stack || err);
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/* ---------- Sesión ---------- */

function apiLogin_(d) {
  const cache = CacheService.getScriptCache();
  const fallos = Number(cache.get('fallos_login') || 0);
  if (fallos >= 10) return { ok: false, error: 'Demasiados intentos. Espera 10 minutos.' };
  const props = PropertiesService.getScriptProperties();
  const pin = String(d.pin || '').trim();
  let rol = null;
  if (pin && pin === props.getProperty('PIN_ADMIN')) rol = 'admin';
  else if (pin && pin === props.getProperty('PIN_EQUIPO')) rol = 'equipo';
  if (!rol) {
    cache.put('fallos_login', String(fallos + 1), 600);
    Utilities.sleep(700);
    return { ok: false, error: 'PIN incorrecto' };
  }
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('tk_' + token, rol, 21600);
  return { ok: true, token: token, rol: rol };
}

function sesion_(token) {
  if (!token || !/^[a-f0-9]{64}$/i.test(String(token))) return null;
  const cache = CacheService.getScriptCache();
  const rol = cache.get('tk_' + token);
  if (!rol) return null;
  cache.put('tk_' + token, rol, 21600); // renueva 6 h
  return { rol: rol, token: token };
}

function apiSalir_(d, ses) {
  CacheService.getScriptCache().remove('tk_' + ses.token);
  return { ok: true };
}

/* ============================================================
 *  PÁGINA PÚBLICA
 * ============================================================ */

function apiServicios_() {
  const c = config_();
  const hoy = hoy_();
  const ap = aperturas_();
  const futuras = {};
  Object.keys(ap).forEach(function (f) { if (f >= hoy) futuras[f] = ap[f]; });
  return {
    ok: true,
    hoy: hoy,
    servicios: servicios_().map(function (s) {
      return { servicio: s.servicio, activo: s.activo, dias: s.dias };
    }),
    aperturas: futuras,
    config: configPublica_(c)
  };
}

function apiHorarios_(d) {
  const c = config_();
  const fecha = String(d.fecha || '');
  const personas = Number(d.personas);
  const v = validarFechaWeb_(fecha, c);
  if (v) return { ok: false, error: v };
  if (d.todas) { // una sola llamada con las horas para 1..máximo de personas
    const ctxT = contexto_(fecha), max = Number(c.maxPersonasWeb) || 10, por = {};
    for (let n = 1; n <= max; n++) {
      por[n] = horariosDia_(fecha, n, ctxT, Number(c.minutosAntelacion) || 0)
        .map(function (s) { return { servicio: s.servicio, hora: s.hora }; });
    }
    return { ok: true, fecha: fecha, porPersonas: por };
  }
  if (!(personas >= 1 && personas <= Number(c.maxPersonasWeb))) return { ok: false, error: 'Número de personas no válido' };
  const ctx = contexto_(fecha);
  const slots = horariosDia_(fecha, personas, ctx, Number(c.minutosAntelacion) || 0)
    .map(function (s) { return { servicio: s.servicio, hora: s.hora }; });
  return { ok: true, fecha: fecha, personas: personas, slots: slots };
}

function apiReservar_(d) {
  if (d.web) return { ok: true, reservaId: 'x', correoEnviado: true }; // campo trampa anti-bots
  const c = config_();
  const r = {
    fecha: String(d.fecha || ''), hora: String(d.hora || ''), servicio: String(d.servicio || ''),
    personas: Number(d.personas),
    nombre: limpiar_(d.nombre, 60), apellidos: limpiar_(d.apellidos, 80),
    email: limpiar_(d.email, 120).toLowerCase(), telefono: limpiar_(d.telefono, 30),
    alergias: limpiar_(d.alergias, 500), notas: ''
  };
  const v = validarFechaWeb_(r.fecha, c);
  if (v) return { ok: false, error: v };
  if (!(r.personas >= 1 && r.personas <= Number(c.maxPersonasWeb))) return { ok: false, error: 'Número de personas no válido' };
  if (!r.nombre || !r.apellidos) return { ok: false, error: 'Escribe tu nombre y apellidos' };
  if (!emailValido_(r.email)) return { ok: false, error: 'El correo no parece correcto' };
  if (r.telefono.replace(/\D/g, '').length < 9) return { ok: false, error: 'El teléfono no parece correcto' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let nueva;
  try {
    const ctx = contexto_(r.fecha);
    // Evita duplicados si el cliente pulsa dos veces
    const dup = ctx.reservas.filter(function (x) {
      return x.fecha === r.fecha && x.hora === r.hora && x.email === r.email && ACTIVAS.indexOf(x.estado) >= 0;
    })[0];
    if (dup) return { ok: true, reservaId: dup.id, correoEnviado: true, repetida: true };

    const hueco = horariosDia_(r.fecha, r.personas, ctx, Number(c.minutosAntelacion) || 0).filter(function (s) {
      return s.hora === r.hora && s.servicio === r.servicio;
    })[0];
    if (!hueco) return { ok: false, error: 'Esa hora acaba de ocuparse. Elige otra, por favor.' };

    nueva = Object.assign(r, {
      id: nuevoId_(), creada: ahoraTxt_(), actualizada: ahoraTxt_(), mesa: hueco.mesa,
      estado: 'Confirmada', origen: 'web', codigo: codigo_(), recordatorio: ''
    });
    anadirFila_(HOJAS.RESERVAS, nueva);
    auditar_(nueva.id, 'Creada', '', resumen_(nueva), 'web');
  } finally {
    lock.releaseLock();
  }
  const enviado = enviarCorreo_('confirmacion', nueva, c);
  if (c.avisarRestaurante !== 'no') enviarCorreo_('aviso_nueva', nueva, c);
  return { ok: true, reservaId: nueva.id, correoEnviado: enviado };
}

function apiVerReserva_(d) {
  const r = reservaConCodigo_(d.id, d.codigo);
  if (!r) return { ok: false, error: 'No encontramos esa reserva. Revisa el enlace del correo.' };
  return { ok: true, reserva: {
    fecha: r.fecha, hora: r.hora, personas: r.personas, nombre: r.nombre, estado: r.estado,
    cancelable: ACTIVAS.indexOf(r.estado) >= 0 && !yaPasada_(r)
  } };
}

function apiCancelarPublica_(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let r;
  try {
    r = reservaConCodigo_(d.id, d.codigo);
    if (!r) return { ok: false, error: 'No encontramos esa reserva. Revisa el enlace del correo.' };
    if (r.estado === 'Cancelada') return { ok: true, yaCancelada: true };
    if (ACTIVAS.indexOf(r.estado) < 0 || yaPasada_(r)) return { ok: false, error: 'Esta reserva ya no se puede cancelar.' };
    const antes = r.estado;
    r.estado = 'Cancelada';
    r.actualizada = ahoraTxt_();
    actualizarFila_(HOJAS.RESERVAS, r._fila, { estado: r.estado, actualizada: r.actualizada });
    auditar_(r.id, 'Cancelada por el cliente', antes, 'Cancelada', 'web');
  } finally {
    lock.releaseLock();
  }
  const c = config_();
  enviarCorreo_('cancelacion', r, c);
  if (c.avisarRestaurante !== 'no') enviarCorreo_('aviso_cancelacion', r, c);
  return { ok: true };
}

function validarFechaWeb_(fecha, c) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'Fecha no válida';
  const hoy = hoy_();
  if (fecha < hoy) return 'Esa fecha ya ha pasado';
  if (fecha > sumarDias_(hoy, Number(c.diasAntelacion) || 60)) return 'Todavía no se puede reservar para esa fecha';
  return '';
}

function reservaConCodigo_(id, codigo) {
  if (!id || !codigo || !/^[a-f0-9]{64}$/.test(String(codigo))) return null;
  const r = leer_(HOJAS.RESERVAS).filter(function (x) { return x.id === String(id); })[0];
  if (!r || !r.codigo || r.codigo !== String(codigo)) return null;
  return r;
}

/* ============================================================
 *  PANEL
 * ============================================================ */

function apiDatos_(d, ses) {
  // Todas las reservas (también las antiguas importadas) para el historial de clientes
  const reservas = leer_(HOJAS.RESERVAS)
    .filter(function (r) { return r.id; })
    .map(publicaReserva_);
  let clientes = [];
  try {
    if (ss_().getSheetByName(HOJAS.CLIENTES)) {
      clientes = leer_(HOJAS.CLIENTES).map(function (c) {
        const o = {}; COLUMNAS.CLIENTES.forEach(function (k) { o[k] = c[k] === undefined ? '' : c[k]; });
        o.reservas = Number(o.reservas) || 0; o.noVino = Number(o.noVino) || 0; o.personas = Number(o.personas) || 0; return o;
      });
    }
  } catch (e) { console.error(e); }
  return {
    ok: true, rol: ses.rol, hoy: hoy_(),
    reservas: reservas,
    mesas: mesas_(),
    servicios: servicios_().map(function (s) {
      return { servicio: s.servicio, activo: s.activo, dias: s.dias, horas: s.horas, duracion: s.duracion, capacidad: s.capacidad };
    }),
    aperturas: aperturas_(),
    config: config_(),
    clientes: clientes
  };
}

function publicaReserva_(r) {
  const o = {};
  COLUMNAS.RESERVAS.forEach(function (k) { if (k !== 'codigo') o[k] = r[k] === undefined ? '' : r[k]; });
  o.personas = Number(r.personas) || 0;
  return o;
}

function apiSugerirMesa_(d) {
  const fecha = String(d.fecha || ''), hora = normHora_(d.hora);
  if (!fecha || !hora) return { ok: true, mesa: '' };
  const ctx = contexto_(fecha, d.id);
  const s = servicioDeHora_(ctx.servs, hora);
  const ini = minutos_(hora), fin = ini + (s ? s.duracion : 90);
  const op = elegirMesa_(ctx.ops, ctx.ocup, ini, fin, Number(d.personas) || 1);
  return { ok: true, mesa: op ? op.id : '' };
}

function apiGuardarReserva_(d, ses) {
  const c = config_();
  const e = d.reserva || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let r, antes = null, avisos = [], tipoCorreo = '';
  try {
    const todas = leer_(HOJAS.RESERVAS);
    if (e.id) {
      antes = todas.filter(function (x) { return x.id === String(e.id); })[0];
      if (!antes) return { ok: false, error: 'No se encuentra esa reserva (¿la han borrado de la hoja?)' };
    }
    r = antes ? Object.assign({}, antes) : {
      id: nuevoId_(), creada: ahoraTxt_(), origen: 'panel', codigo: codigo_(), recordatorio: '', estado: 'Confirmada'
    };
    r.fecha = String(e.fecha || '');
    r.hora = normHora_(e.hora);
    r.personas = Number(e.personas);
    r.nombre = limpiar_(e.nombre, 60);
    r.apellidos = limpiar_(e.apellidos, 80);
    r.email = limpiar_(e.email, 120).toLowerCase();
    r.telefono = limpiar_(e.telefono, 30);
    r.alergias = limpiar_(e.alergias, 500);
    r.notas = limpiar_(e.notas, 500);
    if (e.estado && ESTADOS.indexOf(e.estado) >= 0) r.estado = e.estado;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) return { ok: false, error: 'Fecha no válida' };
    if (!r.hora) return { ok: false, error: 'Hora no válida' };
    if (!(r.personas >= 1 && r.personas <= 200)) return { ok: false, error: 'Número de personas no válido' };
    if (!r.nombre) return { ok: false, error: 'Falta el nombre' };
    if (r.email && !emailValido_(r.email)) return { ok: false, error: 'El correo no parece correcto' };

    const ctx = contexto_(r.fecha, r.id, todas);
    const s = servicioDeHora_(ctx.servs, r.hora);
    r.servicio = s ? s.servicio : (r.servicio || '');
    const ini = minutos_(r.hora), fin = ini + (s ? s.duracion : 90);

    // Mesa
    let mesa = String(e.mesa || '').trim();
    if (mesa === 'auto') {
      const op = elegirMesa_(ctx.ops, ctx.ocup, ini, fin, r.personas);
      mesa = op ? op.id : '';
      if (!op && ACTIVAS.indexOf(r.estado) >= 0) avisos.push('No hay ninguna mesa libre que encaje; la reserva queda sin mesa.');
    }
    r.mesa = mesa;

    if (ACTIVAS.indexOf(r.estado) >= 0 && !d.forzar) {
      const choques = [];
      const mias = mesa ? mesa.split('+').map(function (x) { return x.trim(); }) : [];
      ctx.ocup.forEach(function (o) {
        if (o.ini < fin && ini < o.fin && o.mesas.some(function (m) { return mias.indexOf(m) >= 0; })) {
          choques.push('mesa ' + o.mesas.join('+') + ' ocupada por ' + o.nombre + ' a las ' + o.hora);
        }
      });
      if (s && !cabe_(s, ctx.ocup, ini, fin, r.personas)) {
        choques.push('se supera la capacidad del servicio (' + s.capacidad + ' personas a la vez)');
      }
      if (s && !abierto_(s, r.fecha, ctx.ap)) choques.push('ese día el servicio de ' + s.servicio.toLowerCase() + ' está cerrado');
      if (choques.length) return { ok: false, conflicto: true, error: 'Atención: ' + choques.join('; ') + '.' };
    }

    r.actualizada = ahoraTxt_();
    if (antes) {
      if (antes.fecha !== r.fecha || antes.hora !== r.hora) r.recordatorio = '';
      const cambioImportante = antes.fecha !== r.fecha || antes.hora !== r.hora || Number(antes.personas) !== r.personas;
      if (cambioImportante && ACTIVAS.indexOf(r.estado) >= 0) tipoCorreo = 'modificacion';
      if (r.estado === 'Cancelada' && antes.estado !== 'Cancelada') tipoCorreo = 'cancelacion';
      actualizarFila_(HOJAS.RESERVAS, antes._fila, r);
      auditar_(r.id, 'Editada', resumen_(antes), resumen_(r), 'panel (' + ses.rol + ')');
    } else {
      anadirFila_(HOJAS.RESERVAS, r);
      auditar_(r.id, 'Creada', '', resumen_(r), 'panel (' + ses.rol + ')');
      if (ACTIVAS.indexOf(r.estado) >= 0) tipoCorreo = 'confirmacion';
    }
  } finally {
    lock.releaseLock();
  }
  let correo = null;
  if (tipoCorreo && r.email && d.enviarCorreo) correo = enviarCorreo_(tipoCorreo, r, c);
  return { ok: true, reserva: publicaReserva_(r), avisos: avisos, correo: correo };
}

function apiCambiarEstado_(d, ses) {
  const estado = String(d.estado || '');
  if (ESTADOS.indexOf(estado) < 0) return { ok: false, error: 'Estado no válido' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let r, antes;
  try {
    r = leer_(HOJAS.RESERVAS).filter(function (x) { return x.id === String(d.id); })[0];
    if (!r) return { ok: false, error: 'No se encuentra esa reserva' };
    antes = r.estado;
    r.estado = estado;
    r.actualizada = ahoraTxt_();
    actualizarFila_(HOJAS.RESERVAS, r._fila, { estado: estado, actualizada: r.actualizada });
    auditar_(r.id, 'Cambio de estado', antes, estado, 'panel (' + ses.rol + ')');
  } finally {
    lock.releaseLock();
  }
  let correo = null;
  if (estado === 'Cancelada' && antes !== 'Cancelada' && d.avisar && r.email) {
    correo = enviarCorreo_('cancelacion', r, config_());
  }
  return { ok: true, reserva: publicaReserva_(r), correo: correo };
}

function apiAuditoria_() {
  const filas = leer_(HOJAS.AUDITORIA).slice(-400).reverse();
  return { ok: true, auditoria: filas.map(function (f) {
    return { fecha: f.fecha, reserva: f.reserva, accion: f.accion, antes: f.antes, despues: f.despues, origen: f.origen };
  }) };
}

function apiGuardarServicios_(d, ses) {
  const lista = Array.isArray(d.servicios) ? d.servicios : [];
  if (!lista.length) return { ok: false, error: 'No hay servicios' };
  const filas = lista.map(function (s) {
    const nombre = limpiar_(s.servicio, 40);
    const horas = horas_(Array.isArray(s.horas) ? s.horas.join(',') : s.horas);
    if (!nombre) throw new Error('Falta el nombre de un servicio');
    if (!horas.length) throw new Error('Pon al menos una hora en ' + nombre);
    return [nombre, s.activo ? 'si' : 'no',
      (s.dias || []).map(Number).filter(function (x) { return x >= 0 && x <= 6; }).join(','),
      horas.join(', '), Math.max(15, Number(s.duracion) || 90), Math.max(1, Number(s.capacidad) || 40)];
  });
  reescribir_(HOJAS.SERVICIOS, COLUMNAS.SERVICIOS, filas);
  // Asegura una columna en APERTURAS por servicio
  const sh = hoja_(HOJAS.APERTURAS);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).toLowerCase(); });
  filas.forEach(function (f) {
    const k = f[0].toLowerCase();
    if (cab.indexOf(k) < 0) { sh.getRange(1, sh.getLastColumn() + 1).setValue(k).setFontWeight('bold'); cab.push(k); }
  });
  invalidar_(HOJAS.APERTURAS);
  auditar_('', 'Servicios modificados', '', filas.map(function (f) { return f[0] + ' ' + f[3]; }).join(' | '), 'panel (' + ses.rol + ')');
  return { ok: true };
}

function apiGuardarMesas_(d, ses) {
  const lista = Array.isArray(d.mesas) ? d.mesas : [];
  const vistos = {};
  const filas = lista.map(function (m) {
    const id = limpiar_(m.mesa, 10);
    if (!id) throw new Error('Hay una mesa sin número');
    if (vistos[id]) throw new Error('La mesa ' + id + ' está repetida');
    vistos[id] = 1;
    return [id, m.activa ? 'si' : 'no', Math.max(1, Number(m.capacidad) || 1), Math.max(1, Number(m.minimo) || 1),
      m.forma === 'redonda' ? 'redonda' : 'rectangular',
      Math.min(95, Math.max(0, Number(m.x) || 0)), Math.min(95, Math.max(0, Number(m.y) || 0)),
      limpiar_(m.zona, 30) || 'sala', limpiar_(m.grupo, 30).replace(/\s/g, ''), Number(m.capacidadGrupo) || ''];
  });
  reescribir_(HOJAS.MESAS, COLUMNAS.MESAS, filas);
  auditar_('', 'Mesas modificadas', '', filas.length + ' mesas', 'panel (' + ses.rol + ')');
  return { ok: true, mesas: mesas_() };
}

function apiGuardarApertura_(d, ses) {
  const fecha = String(d.fecha || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: 'Fecha no válida' };
  const sh = hoja_(HOJAS.APERTURAS);
  const filas = leer_(HOJAS.APERTURAS);
  const existente = filas.filter(function (f) { return fecha_(f.fecha) === fecha; })[0];
  if (d.quitar) {
    if (existente) sh.deleteRow(existente._fila);
    invalidar_(HOJAS.APERTURAS);
    auditar_('', 'Día ' + fecha + ' vuelve al horario normal', '', '', 'panel (' + ses.rol + ')');
    return { ok: true, aperturas: aperturas_() };
  }
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const valores = d.valores || {};
  const fila = cab.map(function (k) {
    if (k === 'fecha') return fecha;
    const v = valores[k.toLowerCase()];
    return v === undefined ? (existente ? (existente[k] || '') : '') : (v ? 'si' : 'no');
  });
  if (existente) sh.getRange(existente._fila, 1, 1, fila.length).setValues([fila]);
  else sh.appendRow(fila);
  invalidar_(HOJAS.APERTURAS);
  auditar_('', 'Apertura ' + fecha, '', JSON.stringify(valores), 'panel (' + ses.rol + ')');
  return { ok: true, aperturas: aperturas_() };
}

function apiGuardarConfig_(d, ses) {
  const nuevos = d.config || {};
  const sh = hoja_(HOJAS.CONFIG);
  const filas = leer_(HOJAS.CONFIG);
  Object.keys(CONFIG_DEF).forEach(function (k) {
    if (nuevos[k] === undefined) return;
    let v = String(nuevos[k]).slice(0, k === 'condiciones' || k === 'privacidad' ? 20000 : 1000);
    if (k === 'logo' && v && !/^https:\/\//.test(v)) throw new Error('El logo debe ser una dirección que empiece por https://');
    if (k === 'emailRestaurante' && v && !emailValido_(v)) throw new Error('El correo del restaurante no es válido');
    const f = filas.filter(function (x) { return String(x.clave).trim() === k; })[0];
    if (f) sh.getRange(f._fila, 2).setValue(v);
    else sh.appendRow([k, v]);
  });
  invalidar_(HOJAS.CONFIG);
  auditar_('', 'Personalización guardada', '', '', 'panel (' + ses.rol + ')');
  return { ok: true, config: config_() };
}

function apiCorreoPrueba_() {
  probarCorreo();
  return { ok: true, email: config_().emailRestaurante };
}

/* ============================================================
 *  DISPONIBILIDAD Y MESAS
 * ============================================================ */

function contexto_(fecha, excluirId, reservasYaLeidas) {
  const servs = servicios_();
  const reservas = reservasYaLeidas || leer_(HOJAS.RESERVAS);
  return {
    servs: servs,
    ap: aperturas_(),
    reservas: reservas,
    ops: opcionesMesa_(mesas_()),
    ocup: ocupacion_(reservas, fecha, servs, excluirId)
  };
}

function horariosDia_(fecha, personas, ctx, antelacionMin) {
  const out = [];
  const esHoy = fecha === hoy_();
  const ahora = ahoraMin_();
  ctx.servs.forEach(function (s) {
    if (!abierto_(s, fecha, ctx.ap)) return;
    s.horas.forEach(function (h) {
      const ini = minutos_(h), fin = ini + s.duracion;
      if (esHoy && ini < ahora + (antelacionMin || 0)) return;
      if (!cabe_(s, ctx.ocup, ini, fin, personas)) return;
      const op = elegirMesa_(ctx.ops, ctx.ocup, ini, fin, personas);
      if (!op) return;
      out.push({ servicio: s.servicio, hora: h, mesa: op.id });
    });
  });
  return out;
}

/** Mesas sueltas + uniones definidas en la columna "grupo" (p. ej. 06+07). */
function opcionesMesa_(mesas) {
  const act = mesas.filter(function (m) { return m.activa; });
  const porId = {};
  act.forEach(function (m) { porId[m.mesa] = m; });
  const ops = act.map(function (m) {
    return { id: m.mesa, miembros: [m.mesa], capacidad: m.capacidad, minimo: m.minimo, union: false };
  });
  const vistos = {};
  act.forEach(function (m) {
    if (!m.grupo || vistos[m.grupo]) return;
    vistos[m.grupo] = 1;
    const miembros = m.grupo.split('+').map(function (x) { return x.trim(); }).filter(Boolean);
    if (miembros.length < 2 || !miembros.every(function (x) { return porId[x]; })) return;
    const capDef = Math.max.apply(null, act.filter(function (x) { return x.grupo === m.grupo; })
      .map(function (x) { return x.capacidadGrupo || 0; }).concat([0]));
    const cap = capDef || miembros.reduce(function (t, x) { return t + porId[x].capacidad; }, 0);
    ops.push({ id: miembros.join('+'), miembros: miembros, capacidad: cap, minimo: 1, union: true });
  });
  return ops;
}

function ocupacion_(reservas, fecha, servs, excluirId) {
  return reservas.filter(function (r) {
    return r.fecha === fecha && ACTIVAS.indexOf(r.estado) >= 0 && r.id !== excluirId && r.hora;
  }).map(function (r) {
    const s = servs.filter(function (x) { return x.servicio === r.servicio; })[0] || servicioDeHora_(servs, r.hora);
    const ini = minutos_(r.hora);
    return {
      ini: ini, fin: ini + (s ? s.duracion : 90), personas: Number(r.personas) || 0, hora: r.hora,
      nombre: (r.nombre + ' ' + (r.apellidos || '')).trim(),
      mesas: String(r.mesa || '').split('+').map(function (x) { return x.trim(); }).filter(Boolean)
    };
  });
}

/** Elige la mesa (o unión) libre más ajustada al grupo; ante empate, mejor mesa suelta. */
function elegirMesa_(ops, ocup, ini, fin, personas) {
  const ocupadas = {};
  ocup.forEach(function (o) {
    if (o.ini < fin && ini < o.fin) o.mesas.forEach(function (m) { ocupadas[m] = 1; });
  });
  const libres = ops.filter(function (op) {
    return op.capacidad >= personas && personas >= op.minimo &&
      op.miembros.every(function (m) { return !ocupadas[m]; });
  });
  // Más ajustada primero; si empatan, la mesa suelta y la de mínimo más alto (deja libres las más flexibles)
  libres.sort(function (a, b) {
    return (a.capacidad - b.capacidad) || (Number(a.union) - Number(b.union)) || (b.minimo - a.minimo);
  });
  return libres[0] || null;
}

/** Capacidad del servicio = máximo de personas con reserva sentadas a la vez. */
function cabe_(serv, ocup, ini, fin, personas) {
  const puntos = [ini].concat(ocup.filter(function (o) { return o.ini > ini && o.ini < fin; })
    .map(function (o) { return o.ini; }));
  return puntos.every(function (p) {
    const ya = ocup.filter(function (o) { return o.ini <= p && p < o.fin; })
      .reduce(function (t, o) { return t + o.personas; }, 0);
    return ya + personas <= serv.capacidad;
  });
}

function abierto_(serv, fecha, ap) {
  const ov = ap[fecha];
  const k = serv.servicio.toLowerCase();
  if (ov && ov[k] !== undefined) return ov[k];
  if (!serv.activo) return false;
  const p = fecha.split('-').map(Number);
  const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return serv.dias.indexOf(dow) >= 0;
}

function servicioDeHora_(servs, hora) {
  const m = minutos_(hora);
  let mejor = null, dist = Infinity;
  servs.forEach(function (s) {
    if (!s.horas.length) return;
    const a = minutos_(s.horas[0]), b = minutos_(s.horas[s.horas.length - 1]);
    const dd = m < a ? a - m : (m > b ? m - b : 0);
    if (dd < dist) { dist = dd; mejor = s; }
  });
  return mejor;
}

/* ============================================================
 *  LECTURA DE HOJAS
 * ============================================================ */

function servicios_() {
  return leer_(HOJAS.SERVICIOS).map(function (s) {
    return {
      servicio: String(s.servicio || '').trim(),
      activo: bool_(s.activo),
      dias: String(s.dias || '').split(/[,; ]+/).filter(function (x) { return x !== ''; }).map(Number),
      horas: horas_(s.horas),
      duracion: Math.max(15, Number(s.duracion) || 90),
      capacidad: Math.max(1, Number(s.capacidad) || 40)
    };
  }).filter(function (s) { return s.servicio; });
}

function mesas_() {
  return leer_(HOJAS.MESAS).map(function (m) {
    return {
      mesa: String(m.mesa || '').trim(), activa: bool_(m.activa),
      capacidad: Number(m.capacidad) || 0, minimo: Math.max(1, Number(m.minimo) || 1),
      forma: /^(round|redonda)$/i.test(String(m.forma)) ? 'redonda' : 'rectangular',
      x: Number(m.x) || 0, y: Number(m.y) || 0, zona: String(m.zona || ''),
      grupo: String(m.grupo || '').replace(/\s/g, ''), capacidadGrupo: Number(m.capacidadGrupo) || 0
    };
  }).filter(function (m) { return m.mesa; });
}

function aperturas_() {
  const out = {};
  leer_(HOJAS.APERTURAS).forEach(function (r) {
    const f = fecha_(r.fecha);
    if (!f) return;
    const o = {};
    Object.keys(r).forEach(function (k) {
      if (k === 'fecha' || k === '_fila' || r[k] === '' || r[k] === null) return;
      o[k.toLowerCase()] = bool_(r[k]);
    });
    out[f] = o;
  });
  return out;
}

function config_() {
  const c = Object.assign({}, CONFIG_DEF);
  leer_(HOJAS.CONFIG).forEach(function (r) {
    const k = String(r.clave || '').trim();
    if (k) c[k] = String(r.valor === null || r.valor === undefined ? '' : r.valor);
  });
  return c;
}

function configPublica_(c) {
  return {
    nombre: c.nombre, subtitulo: c.subtitulo, logo: /^https:\/\//.test(c.logo) ? c.logo : '',
    telefono: c.telefono, direccion: c.direccion, condiciones: c.condiciones, privacidad: c.privacidad,
    diasAntelacion: Number(c.diasAntelacion) || 60, maxPersonasWeb: Number(c.maxPersonasWeb) || 10
  };
}

/* Velocidad: cada ejecución recuerda lo que ya ha leído (_memo) y las pestañas que casi no cambian
 * (mesas, servicios, aperturas, config) se guardan 5 min en la caché de Apps Script. Lo que se guarda
 * desde el panel se ve al momento; lo que se edite a mano en la hoja tarda hasta 5 min en verse. */
let _ss = null;
const _hojas = {}, _memo = {};
const CACHEABLES = ['MESAS', 'SERVICIOS', 'APERTURAS', 'CONFIG'];

function ss_() {
  if (_ss) return _ss;
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  _ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return _ss;
}

function hoja_(nombre) {
  if (_hojas[nombre]) return _hojas[nombre];
  const sh = ss_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la pestaña ' + nombre + '. Ejecuta instalar().');
  _hojas[nombre] = sh;
  return sh;
}

function invalidar_(nombre) {
  delete _memo[nombre];
  if (CACHEABLES.indexOf(nombre) >= 0) {
    try { CacheService.getScriptCache().remove('hoja_' + nombre); } catch (e) {}
  }
}

/** Para borrar la caché a mano tras editar la hoja directamente. */
function limpiarCache() { CACHEABLES.forEach(invalidar_); console.log('Caché borrada'); }

function leer_(nombre) {
  if (_memo[nombre]) return _memo[nombre];
  const cacheable = CACHEABLES.indexOf(nombre) >= 0;
  if (cacheable) {
    try {
      const c = CacheService.getScriptCache().get('hoja_' + nombre);
      if (c) return (_memo[nombre] = JSON.parse(c));
    } catch (e) {}
  }
  const out = leerHoja_(nombre);
  _memo[nombre] = out;
  if (cacheable) {
    try { const j = JSON.stringify(out); if (j.length < 90000) CacheService.getScriptCache().put('hoja_' + nombre, j, 300); } catch (e) {}
  }
  return out;
}

function leerHoja_(nombre) {
  const sh = hoja_(nombre);
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const cab = v[0].map(function (x) { return String(x).trim(); });
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const fila = v[i];
    if (!fila.some(function (c) { return c !== '' && c !== null; })) continue;
    const o = { _fila: i + 1 };
    cab.forEach(function (k, j) { if (k) o[k] = norm_(fila[j], k); });
    out.push(o);
  }
  return out;
}

function norm_(v, k) {
  if (v instanceof Date) {
    if (k === 'hora') return Utilities.formatDate(v, TZ, 'HH:mm');
    if (k === 'fecha' && !(v.getHours() || v.getMinutes())) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm');
  }
  if (v === null || v === undefined) return '';
  if (k === 'hora') return normHora_(v);
  if (k === 'fecha' && typeof v === 'string') return v.trim();
  return typeof v === 'string' ? v.trim() : v;
}

function cabecera_(nombre) {
  const sh = hoja_(nombre);
  return { sh: sh, cab: sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); }) };
}

function anadirFila_(nombre, obj) {
  const h = cabecera_(nombre);
  invalidar_(nombre);
  h.sh.appendRow(h.cab.map(function (k) { const v = obj[k]; return v === undefined || v === null ? '' : String(v); }));
}

function actualizarFila_(nombre, fila, obj) {
  const h = cabecera_(nombre);
  invalidar_(nombre);
  const rango = h.sh.getRange(fila, 1, 1, h.cab.length);
  const actual = rango.getValues()[0];
  rango.setValues([h.cab.map(function (k, j) {
    if (k === '_fila' || obj[k] === undefined) return actual[j];
    return obj[k] === null ? '' : String(obj[k]);
  })]);
}

function reescribir_(nombre, columnas, filas) {
  const sh = hoja_(nombre);
  invalidar_(nombre);
  sh.clearContents();
  sh.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight('bold');
  if (filas.length) {
    sh.getRange(2, 1, filas.length, columnas.length).setNumberFormat('@')
      .setValues(filas.map(function (f) { return f.map(function (x) { return x === null || x === undefined ? '' : String(x); }); }));
  }
}

function auditar_(reserva, accion, antes, despues, origen) {
  try { hoja_(HOJAS.AUDITORIA).appendRow([ahoraTxt_(), reserva || '', accion, String(antes || ''), String(despues || ''), origen]); }
  catch (e) { console.error(e); }
}

/* ============================================================
 *  CORREOS
 * ============================================================ */

function enviarCorreo_(tipo, r, c) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) { console.warn('Sin cupo de correos hoy'); return false; }
    const para = tipo.indexOf('aviso_') === 0 ? c.emailRestaurante : r.email;
    if (!para) return false;
    const nombre = esc_(r.nombre);
    const det = detalles_(r);
    const enlaces = enlacesCliente_(r, c);
    let asunto, cuerpo;
    switch (tipo) {
      case 'confirmacion':
        asunto = c.asuntoConfirmacion || ('Reserva confirmada · ' + c.nombre);
        cuerpo = '<p>Hola ' + nombre + ',</p><p>' + esc_(c.textoConfirmacion) + '</p>' + det + enlaces;
        break;
      case 'modificacion':
        asunto = 'Reserva modificada · ' + c.nombre;
        cuerpo = '<p>Hola ' + nombre + ',</p><p>Hemos actualizado tu reserva. Estos son los datos nuevos:</p>' + det + enlaces;
        break;
      case 'recordatorio':
        asunto = 'Recordatorio de tu reserva · ' + c.nombre;
        cuerpo = '<p>Hola ' + nombre + ',</p><p>' + esc_(c.textoRecordatorio) + '</p>' + det + enlaces;
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
      default: return false;
    }
    MailApp.sendEmail({
      to: para, subject: asunto, htmlBody: plantilla_(c, asunto, cuerpo), name: c.nombre,
      replyTo: tipo.indexOf('aviso_') === 0 ? (r.email || c.emailRestaurante) : c.emailRestaurante
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
  return '<p style="font-size:14px;color:#555">' + esc_((r.nombre + ' ' + (r.apellidos || '')).trim()) +
    '<br>' + esc_(r.telefono || '') + '<br>' + esc_(r.email || '') + '<br>Mesa: ' + esc_(r.mesa || 'sin asignar') + '</p>';
}

function enlacesCliente_(r, c) {
  const p = r.fecha.split('-'), h = r.hora.split(':');
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
  if (c.urlPublica && r.codigo) {
    const sep = c.urlPublica.indexOf('?') >= 0 ? '&' : '?';
    html += boton(c.urlPublica + sep + 'cancelar=' + encodeURIComponent(r.id) + '&codigo=' + r.codigo, 'Cancelar reserva', '#eee', '#555');
  }
  html += '</p>';
  if (c.telefono) html += '<p style="font-size:13px;color:#777">¿Algún cambio? Llámanos al ' + esc_(c.telefono) + '.</p>';
  return html;
}

function plantilla_(c, titulo, cuerpo) {
  const logo = /^https:\/\//.test(c.logo) ? '<img src="' + esc_(c.logo) + '" alt="" style="max-height:56px;margin-bottom:8px"><br>' : '';
  return '<div style="background:#f4f4f2;padding:24px 12px;font-family:Arial,sans-serif;color:#292929">' +
    '<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:26px 24px;box-shadow:0 8px 24px #0000000d">' +
    logo + '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#777">' + esc_(c.nombre) + '</div>' +
    '<h1 style="font-size:22px;margin:6px 0 14px">' + esc_(titulo) + '</h1>' + cuerpo +
    '</div><p style="text-align:center;font-size:11px;color:#999;margin-top:14px">' + esc_(c.nombre) +
    (c.direccion ? ' · ' + esc_(c.direccion) : '') + '</p></div>';
}

/* ============================================================
 *  RECORDATORIOS (activador cada 15 min)
 * ============================================================ */

function recordatorios() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const c = config_();
    const ahora = ahoraTxt_();
    const hoy = hoy_(), manana = sumarDias_(hoy, 1);
    leer_(HOJAS.RESERVAS).forEach(function (r) {
      if (r.estado !== 'Confirmada' || r.recordatorio || !r.email) return;
      if (r.fecha !== hoy && r.fecha !== manana) return;
      const faltan = minutosEntre_(ahora, r.fecha + ' ' + r.hora);
      if (faltan > 0 && faltan <= 120) {
        const ok = enviarCorreo_('recordatorio', r, c);
        actualizarFila_(HOJAS.RESERVAS, r._fila, { recordatorio: ok ? ahoraTxt_() : 'error ' + ahoraTxt_() });
      }
    });
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
 *  IMPORTAR DESDE EL PANEL (Clientes → Importar de Vento)
 * ============================================================ */

function claveCliente_(email, telefono, nombre) {
  const e = String(email || '').trim().toLowerCase();
  if (e) return e;
  const t = String(telefono || '').replace(/\D/g, '').replace(/^34(?=\d{9}$)/, '');
  if (t) return 'tel:' + t;
  const n = String(nombre || '').trim().toLowerCase();
  return n ? 'n:' + n : '';
}

function fechaFlexible_(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
  if (/^\d{10,13}$/.test(s)) return Utilities.formatDate(new Date(Number(s) * (s.length === 10 ? 1000 : 1)), TZ, 'yyyy-MM-dd');
  return '';
}

function asegurarHoja_(nombre) {
  if (!ss_().getSheetByName(nombre)) {
    crearHoja_(ss_(), nombre, COLUMNAS[nombre], []);
    delete _hojas[nombre];
  }
}

function apiImportarClientes_(d, ses) {
  const filas = Array.isArray(d.filas) ? d.filas : [];
  if (!filas.length) return { ok: false, error: 'El archivo no tiene filas' };
  asegurarHoja_(HOJAS.CLIENTES);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const mapa = {};
    leer_(HOJAS.CLIENTES).forEach(function (c) { if (c.clave) mapa[c.clave] = c; });
    let nuevos = 0, actualizados = 0, saltados = 0;
    filas.forEach(function (x) {
      const nombre = limpiar_(x.nombre, 80), apellidos = limpiar_(x.apellidos, 100);
      const email = limpiar_(x.email, 120).toLowerCase(), telefono = limpiar_(x.telefono, 30);
      const clave = claveCliente_(email, telefono, (nombre + ' ' + apellidos).trim());
      if (!clave) { saltados++; return; }
      const prev = mapa[clave];
      const c = {
        clave: clave, nombre: nombre || (prev && prev.nombre) || '', apellidos: apellidos || (prev && prev.apellidos) || '',
        email: email || (prev && prev.email) || '', telefono: telefono || (prev && prev.telefono) || '',
        telefono2: limpiar_(x.telefono2, 30) || (prev && prev.telefono2) || '',
        personas: Number(x.personas) || (prev && Number(prev.personas)) || 0,
        suscrito: x.suscrito === undefined || x.suscrito === '' ? ((prev && prev.suscrito) || '') : (bool_(x.suscrito) ? 'si' : 'no'),
        empresa: limpiar_(x.empresa, 100) || (prev && prev.empresa) || '',
        primera: fechaFlexible_(x.primera) || (prev && prev.primera) || '',
        ultima: fechaFlexible_(x.ultima) || (prev && prev.ultima) || '',
        reservas: Number(x.reservas) || (prev && Number(prev.reservas)) || 0,
        noVino: Number(x.noVino) || (prev && Number(prev.noVino)) || 0,
        notas: limpiar_(x.notas, 1000) || (prev && prev.notas) || '', origen: 'vento'
      };
      if (prev) actualizados++; else nuevos++;
      mapa[clave] = c;
    });
    const out = Object.keys(mapa).map(function (k) {
      const c = mapa[k]; return COLUMNAS.CLIENTES.map(function (col) { return c[col] === undefined ? '' : c[col]; });
    });
    reescribir_(HOJAS.CLIENTES, COLUMNAS.CLIENTES, out);
    auditar_('', 'Clientes importados', '', nuevos + ' nuevos, ' + actualizados + ' actualizados', 'panel (' + ses.rol + ')');
    return { ok: true, nuevos: nuevos, actualizados: actualizados, saltados: saltados, total: out.length };
  } finally { lock.releaseLock(); }
}

function apiImportarReservas_(d, ses) {
  const filas = Array.isArray(d.filas) ? d.filas : [];
  if (!filas.length) return { ok: false, error: 'El archivo no tiene filas' };
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const existentes = {};
    leer_(HOJAS.RESERVAS).forEach(function (r) { existentes[r.id] = 1; });
    const servs = servicios_(), hoy = hoy_(), ahora = ahoraTxt_();
    const h = cabecera_(HOJAS.RESERVAS);
    const nuevas = [];
    let saltadas = 0, n = 0;
    filas.forEach(function (x) {
      const fecha = fechaFlexible_(x.fecha), hora = normHora_(x.hora);
      if (!fecha || !hora) { saltadas++; return; }
      const base = String(x.id || '').trim() || (fecha + hora + (x.email || x.telefono || x.nombre || ''));
      const id = 'V' + base.replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
      if (existentes[id]) { saltadas++; return; }
      const s = servicioDeHora_(servs, hora);
      let estado = String(x.estado || '').trim();
      const est = ESTADOS.filter(function (e) { return e.toLowerCase() === estado.toLowerCase(); })[0];
      estado = est || (/cancel/i.test(estado) ? 'Cancelada' : /no.?pres|no.?show/i.test(estado) ? 'No presentado' : (fecha < hoy ? 'Finalizada' : 'Confirmada'));
      const r = {
        id: id, creada: ahora, actualizada: ahora, fecha: fecha, hora: hora, servicio: s ? s.servicio : '',
        personas: Math.max(1, Number(x.personas) || 1), mesa: String(x.mesa || '').trim(),
        nombre: limpiar_(x.nombre, 60), apellidos: limpiar_(x.apellidos, 80), email: limpiar_(x.email, 120).toLowerCase(),
        telefono: limpiar_(x.telefono, 30), alergias: limpiar_(x.alergias, 500), notas: limpiar_(x.notas, 500),
        estado: estado, origen: 'vento', codigo: codigo_(), recordatorio: fecha < hoy ? 'importada' : ''
      };
      nuevas.push(h.cab.map(function (k) { const v = r[k]; return v === undefined || v === null ? '' : String(v); }));
      existentes[id] = 1; n++;
    });
    if (nuevas.length) {
      invalidar_(HOJAS.RESERVAS);
      h.sh.getRange(h.sh.getLastRow() + 1, 1, nuevas.length, h.cab.length).setNumberFormat('@').setValues(nuevas);
    }
    auditar_('', 'Reservas importadas', '', n + ' importadas', 'panel (' + ses.rol + ')');
    return { ok: true, importadas: n, saltadas: saltadas };
  } finally { lock.releaseLock(); }
}

/* ============================================================
 *  IMPORTAR RESERVAS DE VENTO (opcional)
 *  Pega el CSV de reservas en una pestaña llamada IMPORTAR
 *  (columnas: id, fecha, hora, nombre, email, telefono, personas,
 *  mesa, estado, notas) y ejecuta esta función.
 * ============================================================ */

function importarReservasVento() {
  const datos = leer_('IMPORTAR');
  const existentes = {};
  leer_(HOJAS.RESERVAS).forEach(function (r) { existentes[r.id] = 1; });
  const servs = servicios_();
  let n = 0;
  datos.forEach(function (x) {
    const id = 'V' + String(x.id || x._id || '').trim();
    const fecha = fecha_(x.fecha), hora = normHora_(x.hora);
    if (id === 'V' || existentes[id] || !fecha || !hora) return;
    const s = servicioDeHora_(servs, hora);
    anadirFila_(HOJAS.RESERVAS, {
      id: id, creada: ahoraTxt_(), actualizada: ahoraTxt_(), fecha: fecha, hora: hora,
      servicio: s ? s.servicio : '', personas: Number(x.personas) || 1, mesa: String(x.mesa || ''),
      nombre: String(x.nombre || ''), apellidos: String(x.apellidos || ''), email: String(x.email || '').toLowerCase(),
      telefono: String(x.telefono || ''), alergias: String(x.alergias || ''), notas: String(x.notas || ''),
      estado: ESTADOS.indexOf(String(x.estado)) >= 0 ? String(x.estado) : 'Confirmada',
      origen: 'vento', codigo: codigo_(), recordatorio: fecha < hoy_() ? 'importada' : ''
    });
    existentes[id] = 1;
    n++;
  });
  console.log('Importadas ' + n + ' reservas.');
}

/* ============================================================
 *  UTILIDADES
 * ============================================================ */

function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function ahoraTxt_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function ahoraMin_() { return minutos_(Utilities.formatDate(new Date(), TZ, 'HH:mm')); }

function sumarDias_(fecha, n) {
  const p = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

/** Minutos entre dos textos 'yyyy-MM-dd HH:mm' (misma zona horaria). */
function minutosEntre_(a, b) {
  const t = function (s) {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
  };
  return (t(b) - t(a)) / 60000;
}

function yaPasada_(r) { return minutosEntre_(ahoraTxt_(), r.fecha + ' ' + (r.hora || '23:59')) < 0; }

function minutos_(h) { const p = String(h || '0:0').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }

function normHora_(h) {
  const m = String(h || '').trim().match(/^(\d{1,2})[:.h](\d{2})/);
  if (!m || +m[1] > 23 || +m[2] > 59) return '';
  return ('0' + m[1]).slice(-2) + ':' + m[2];
}

function horas_(t) {
  const vistas = {};
  return String(t || '').split(/[,; ]+/).map(normHora_).filter(function (h) {
    if (!h || vistas[h]) return false; vistas[h] = 1; return true;
  }).sort();
}

function fecha_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function fechaLarga_(f) {
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const p = String(f).split('-').map(Number);
  if (p.length < 3) return String(f);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return dias[d.getUTCDay()] + ' ' + p[2] + ' de ' + meses[p[1] - 1];
}

function bool_(v) { return v === true || /^(true|si|sí|1|x|verdadero|yes)$/i.test(String(v).trim()); }
function limpiar_(v, max) { return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function emailValido_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e)); }

function esc_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function nuevoId_() {
  return 'R' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
}

function codigo_() {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now() + Math.random());
  return b.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
}

function resumen_(r) {
  return [r.fecha, r.hora, r.personas + ' pax', 'mesa ' + (r.mesa || '-'), r.nombre, r.estado].join(' · ');
}
