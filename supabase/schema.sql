-- ============================================================
--  RESERVAS PIZZBURGER · Base de datos (Supabase / PostgreSQL)
-- ============================================================
--  Este archivo se aplica SOLO desde GitHub (Actions → "Supabase")
--  cada vez que cambia. Se puede ejecutar las veces que haga falta:
--  no borra datos ni duplica nada. (v4: sin correos)
--
--  Todo vive en el esquema privado "pzb" (no accesible desde fuera).
--  La web y el panel solo pueden llamar a dos funciones:
--    public.publico(p)  → página de reservas (cualquiera)
--    public.panel(p)    → panel (solo personal con sesión iniciada)
-- ============================================================

create schema if not exists pzb;
revoke all on schema pzb from public;

/* ------------------------------------------------------------
 *  LIMPIEZA DEL CORREO (la app ya no envía correos)
 *  Se deja aquí, idempotente, para retirar lo que hubiera en la
 *  base de datos de antes. Las extensiones pg_net y pg_cron no se
 *  tocan: quedan instaladas pero sin uso.
 * ------------------------------------------------------------ */

do $$ begin
  perform cron.unschedule('pzb-recordatorios');
exception when others then null; end $$;

drop function if exists pzb.enviar_recordatorios();
drop function if exists pzb.panel_correo_prueba();
drop function if exists pzb.correo(text, pzb.reservas);
drop table if exists pzb.secretos;

/* ------------------------------------------------------------
 *  TABLAS
 * ------------------------------------------------------------ */

create table if not exists pzb.mesas (
  mesa text primary key,
  activa boolean not null default true,
  capacidad int not null default 2,
  minimo int not null default 1,
  forma text not null default 'rectangular',
  x numeric not null default 0,
  y numeric not null default 0,
  zona text not null default 'sala',
  grupo text not null default '',
  capacidad_grupo int,
  orden int not null default 0
);

create table if not exists pzb.servicios (
  servicio text primary key,
  activo boolean not null default true,
  dias int[] not null default '{}',
  horas text[] not null default '{}',
  duracion int not null default 90,
  capacidad int not null default 40,
  orden int not null default 0
);

create table if not exists pzb.aperturas (
  fecha date primary key,
  valores jsonb not null default '{}'
);

create table if not exists pzb.config (
  clave text primary key,
  valor text not null default ''
);

create table if not exists pzb.personal (
  email text primary key,
  rol text not null check (rol in ('equipo', 'admin'))
);

create table if not exists pzb.reservas (
  id text primary key,
  creada timestamp not null default (now() at time zone 'Europe/Madrid'),
  actualizada timestamp not null default (now() at time zone 'Europe/Madrid'),
  fecha date not null,
  hora text not null,
  servicio text not null default '',
  personas int not null,
  mesa text not null default '',
  nombre text not null default '',
  apellidos text not null default '',
  email text not null default '',
  telefono text not null default '',
  alergias text not null default '',
  notas text not null default '',
  estado text not null default 'Confirmada',
  origen text not null default 'panel',
  codigo text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
alter table pzb.reservas drop column if exists recordatorio;
create index if not exists reservas_fecha_idx on pzb.reservas (fecha);
create index if not exists reservas_email_idx on pzb.reservas (email);

create table if not exists pzb.clientes (
  clave text primary key,
  nombre text not null default '',
  apellidos text not null default '',
  email text not null default '',
  telefono text not null default '',
  telefono2 text not null default '',
  primera date,
  ultima date,
  reservas int not null default 0,
  personas int not null default 0,
  no_vino int not null default 0,
  suscrito text not null default '',
  empresa text not null default '',
  notas text not null default '',
  origen text not null default ''
);

create table if not exists pzb.auditoria (
  id bigserial primary key,
  fecha timestamp not null default (now() at time zone 'Europe/Madrid'),
  reserva text not null default '',
  accion text not null default '',
  antes text not null default '',
  despues text not null default '',
  origen text not null default ''
);

-- Nadie entra a las tablas directamente: solo a través de las funciones
do $$ begin
  execute 'revoke all on all tables in schema pzb from anon, authenticated';
  execute 'revoke all on all sequences in schema pzb from anon, authenticated';
exception when undefined_object then null; end $$;

/* ------------------------------------------------------------
 *  DATOS INICIALES (solo si no existen; exportados de Vento)
 * ------------------------------------------------------------ */

insert into pzb.mesas (mesa, activa, capacidad, minimo, forma, x, y, zona, grupo, capacidad_grupo, orden) values
  ('01', true, 5, 4, 'rectangular', 8, 8, 'sala', '', null, 1),
  ('02', true, 9, 4, 'rectangular', 8, 29, 'sala', '', null, 2),
  ('03', true, 2, 1, 'rectangular', 8, 50, 'sala', '', null, 3),
  ('04', true, 9, 6, 'rectangular', 8, 71, 'sala', '', null, 4),
  ('05', true, 2, 1, 'redonda', 44, 50, 'sala', '', null, 5),
  ('06', true, 5, 1, 'redonda', 63, 50, 'sala', '06+07', 10, 6),
  ('07', true, 5, 1, 'redonda', 79, 50, 'sala', '06+07', 10, 7),
  ('08', true, 2, 1, 'redonda', 62, 75, 'sala', '', null, 8),
  ('09', true, 5, 5, 'redonda', 81, 74, 'sala', '', null, 9),
  ('10', true, 4, 3, 'redonda', 77, 8, 'sala', '', null, 10),
  ('11', true, 2, 1, 'rectangular', 57, 29, 'sala', '11+12', null, 11),
  ('12', true, 2, 1, 'rectangular', 68, 29, 'sala', '11+12', null, 12),
  ('13', true, 2, 1, 'rectangular', 79, 29, 'sala', '13+14', null, 13),
  ('14', true, 2, 1, 'rectangular', 90, 29, 'sala', '13+14', null, 14)
on conflict (mesa) do nothing;

insert into pzb.servicios (servicio, activo, dias, horas, duracion, capacidad, orden) values
  ('Cenas', true, '{0,3,4,5,6}', '{20:00,20:30,21:00,21:30,22:00,22:30}', 90, 40, 1),
  ('Comidas', false, '{0,6}', '{13:00,13:30,14:00,14:30,15:00}', 90, 40, 2)
on conflict (servicio) do nothing;

insert into pzb.aperturas (fecha, valores) values
  ('2026-01-05', '{"comidas":false,"cenas":true}'), ('2026-01-06', '{"comidas":false,"cenas":true}'),
  ('2026-01-07', '{"comidas":false,"cenas":false}'), ('2026-01-08', '{"comidas":false,"cenas":false}'),
  ('2026-06-22', '{"comidas":false,"cenas":false}'), ('2026-10-31', '{"comidas":true,"cenas":true}'),
  ('2026-11-01', '{"comidas":true,"cenas":true}'), ('2026-11-02', '{"comidas":true,"cenas":true}'),
  ('2026-11-04', '{"comidas":false,"cenas":false}'), ('2026-12-05', '{"comidas":true,"cenas":true}'),
  ('2026-12-06', '{"comidas":true,"cenas":true}'), ('2026-12-07', '{"comidas":true,"cenas":true}'),
  ('2026-12-08', '{"comidas":true,"cenas":true}'), ('2026-12-09', '{"comidas":false,"cenas":false}'),
  ('2026-12-10', '{"comidas":false,"cenas":false}'), ('2026-12-21', '{"comidas":false,"cenas":true}'),
  ('2026-12-22', '{"comidas":true,"cenas":false}'), ('2026-12-24', '{"comidas":false,"cenas":false}'),
  ('2026-12-28', '{"comidas":false,"cenas":true}'), ('2026-12-29', '{"comidas":false,"cenas":true}'),
  ('2026-12-31', '{"comidas":false,"cenas":false}'), ('2027-01-04', '{"comidas":false,"cenas":true}'),
  ('2027-01-05', '{"comidas":false,"cenas":true}'), ('2027-01-07', '{"comidas":false,"cenas":false}')
on conflict (fecha) do nothing;

insert into pzb.config (clave, valor) values
  ('nombre', 'Pizzburger'),
  ('subtitulo', 'Elige cuándo quieres venir'),
  ('logo', ''),
  ('telefono', ''),
  ('direccion', 'Trujillo'),
  ('condiciones', ''),
  ('privacidad', ''),
  ('diasAntelacion', '60'),
  ('minutosAntelacion', '60'),
  ('maxPersonasWeb', '10')
on conflict (clave) do nothing;

-- Ajustes que solo servían para los correos
delete from pzb.config where clave in
  ('emailRestaurante', 'urlPublica', 'asuntoConfirmacion', 'textoConfirmacion', 'textoRecordatorio', 'avisarRestaurante');

insert into pzb.personal (email, rol) values
  ('equipo@pizzburger.app', 'equipo'),
  ('admin@pizzburger.app', 'admin')
on conflict (email) do nothing;

/* ------------------------------------------------------------
 *  UTILIDADES
 * ------------------------------------------------------------ */

create or replace function pzb.ahora() returns timestamp language sql stable as
$$ select (now() at time zone 'Europe/Madrid')::timestamp(0) $$;

create or replace function pzb.hoy() returns date language sql stable as
$$ select pzb.ahora()::date $$;

create or replace function pzb.txt_ts(t timestamp) returns text language sql immutable as
$$ select coalesce(to_char(t, 'YYYY-MM-DD HH24:MI'), '') $$;

create or replace function pzb.txt_f(f date) returns text language sql immutable as
$$ select coalesce(to_char(f, 'YYYY-MM-DD'), '') $$;

create or replace function pzb.norm_hora(h text) returns text language plpgsql immutable as $$
declare m text[];
begin
  m := regexp_match(coalesce(trim(h), ''), '^(\d{1,2})[:.h](\d{2})');
  if m is null or m[1]::int > 23 or m[2]::int > 59 then return ''; end if;
  return lpad(m[1], 2, '0') || ':' || m[2];
end $$;

create or replace function pzb.minutos(h text) returns int language sql immutable as $$
  select case when pzb.norm_hora(h) = '' then 0
    else split_part(pzb.norm_hora(h), ':', 1)::int * 60 + split_part(pzb.norm_hora(h), ':', 2)::int end
$$;

create or replace function pzb.horas_lista(v jsonb) returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct h order by h), '{}') from (
    select pzb.norm_hora(x) h from regexp_split_to_table(
      case when jsonb_typeof(v) = 'array' then (select string_agg(e, ',') from jsonb_array_elements_text(v) e)
           else coalesce(v #>> '{}', '') end, '[,; ]+') x
  ) t where h <> ''
$$;

create or replace function pzb.limpiar(v text, maximo int) returns text language sql immutable as
$$ select left(trim(regexp_replace(coalesce(v, ''), '[\x00-\x1f]', ' ', 'g')), maximo) $$;

create or replace function pzb.email_ok(e text) returns boolean language sql immutable as
$$ select coalesce(e, '') ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' $$;

create or replace function pzb.fecha_ok(t text) returns date language plpgsql immutable as $$
begin
  if coalesce(t, '') !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return t::date;
exception when others then return null;
end $$;

-- Fechas tal como vienen de Vento/Excel: 26/12/2024 21:00, 2024-12-26, marcas de tiempo…
create or replace function pzb.fecha_flexible(t text) returns date language plpgsql immutable as $$
declare s text := trim(coalesce(t, '')); m text[];
begin
  m := regexp_match(s, '^(\d{4})-(\d{1,2})-(\d{1,2})');
  if m is not null then return make_date(m[1]::int, m[2]::int, m[3]::int); end if;
  m := regexp_match(s, '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})');
  if m is not null then
    return make_date(case when length(m[3]) = 2 then 2000 + m[3]::int else m[3]::int end, m[2]::int, m[1]::int);
  end if;
  if s ~ '^\d{10}$' then return (to_timestamp(s::bigint) at time zone 'Europe/Madrid')::date; end if;
  if s ~ '^\d{13}$' then return (to_timestamp(s::bigint / 1000) at time zone 'Europe/Madrid')::date; end if;
  return null;
exception when others then return null;
end $$;

create or replace function pzb.cfg(k text, def text default '') returns text language sql stable as
$$ select coalesce((select valor from pzb.config where clave = k), def) $$;

create or replace function pzb.config_json() returns jsonb language sql stable as
$$ select coalesce(jsonb_object_agg(clave, valor), '{}') from pzb.config $$;

create or replace function pzb.nuevo_id() returns text language sql volatile as
$$ select 'R' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)) $$;

create or replace function pzb.activas() returns text[] language sql immutable as
$$ select array['Pendiente', 'Confirmada', 'Sentados'] $$;

create or replace function pzb.estados() returns text[] language sql immutable as
$$ select array['Pendiente', 'Confirmada', 'Sentados', 'Finalizada', 'Cancelada', 'No presentado'] $$;

create or replace function pzb.resumen(r pzb.reservas) returns text language sql immutable as $$
  select concat_ws(' · ', pzb.txt_f(r.fecha), r.hora, r.personas || ' pax', 'mesa ' || coalesce(nullif(r.mesa, ''), '-'), r.nombre, r.estado)
$$;

create or replace function pzb.auditar(p_reserva text, p_accion text, p_antes text, p_despues text, p_origen text) returns void
language sql volatile as $$
  insert into pzb.auditoria (reserva, accion, antes, despues, origen)
  values (coalesce(p_reserva, ''), p_accion, coalesce(p_antes, ''), coalesce(p_despues, ''), coalesce(p_origen, ''))
$$;

create or replace function pzb.reserva_json(r pzb.reservas, con_codigo boolean default false) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', r.id, 'creada', pzb.txt_ts(r.creada), 'actualizada', pzb.txt_ts(r.actualizada),
    'fecha', pzb.txt_f(r.fecha), 'hora', r.hora, 'servicio', r.servicio, 'personas', r.personas, 'mesa', r.mesa,
    'nombre', r.nombre, 'apellidos', r.apellidos, 'email', r.email, 'telefono', r.telefono,
    'alergias', r.alergias, 'notas', r.notas, 'estado', r.estado, 'origen', r.origen
  ) || case when con_codigo then jsonb_build_object('codigo', r.codigo) else '{}'::jsonb end
$$;

create or replace function pzb.clave_cliente(p_email text, p_tel text, p_nombre text) returns text language sql immutable as $$
  select case
    when trim(lower(coalesce(p_email, ''))) <> '' then trim(lower(p_email))
    when regexp_replace(coalesce(p_tel, ''), '\D', '', 'g') <> '' then
      'tel:' || regexp_replace(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), '^34(\d{9})$', '\1')
    when trim(lower(coalesce(p_nombre, ''))) <> '' then 'n:' || trim(lower(p_nombre))
    else '' end
$$;

/* ------------------------------------------------------------
 *  DISPONIBILIDAD Y MESAS
 * ------------------------------------------------------------ */

create or replace function pzb.abierto(s pzb.servicios, f date) returns boolean language sql stable as $$
  select coalesce(
    (select (a.valores ->> lower(s.servicio))::boolean from pzb.aperturas a
      where a.fecha = f and a.valores ? lower(s.servicio)),
    s.activo and extract(dow from f)::int = any (s.dias))
$$;

-- Servicio al que pertenece una hora (el más cercano a su franja)
create or replace function pzb.servicio_de_hora(h text) returns pzb.servicios language sql stable as $$
  select s.* from pzb.servicios s where cardinality(s.horas) > 0
  order by greatest(pzb.minutos(s.horas[1]) - pzb.minutos(h), pzb.minutos(h) - pzb.minutos(s.horas[cardinality(s.horas)]), 0), s.orden
  limit 1
$$;

create or replace function pzb.ocupacion(f date, excluir text)
returns table (ini int, fin int, personas int, mesas text[], nombre text, hora text) language sql stable as $$
  select pzb.minutos(r.hora),
         pzb.minutos(r.hora) + coalesce(s.duracion, (pzb.servicio_de_hora(r.hora)).duracion, 90),
         r.personas,
         array(select trim(x) from unnest(string_to_array(r.mesa, '+')) x where trim(x) <> ''),
         trim(r.nombre || ' ' || r.apellidos),
         r.hora
  from pzb.reservas r
  left join pzb.servicios s on s.servicio = r.servicio
  where r.fecha = f and r.estado = any (pzb.activas()) and r.id is distinct from excluir and r.hora <> ''
$$;

-- Mesas sueltas + uniones definidas en "grupo" (p. ej. 06+07)
create or replace function pzb.opciones()
returns table (id text, miembros text[], capacidad int, minimo int, es_union boolean) language sql stable as $$
  select m.mesa, array[m.mesa], m.capacidad, m.minimo, false from pzb.mesas m where m.activa
  union all
  select g.grupo, g.miembros, coalesce(nullif(g.capg, 0), g.suma)::int, 1, true
  from (
    select m.grupo, string_to_array(m.grupo, '+') miembros, max(coalesce(m.capacidad_grupo, 0)) capg,
      (select sum(x.capacidad) from pzb.mesas x where x.activa and x.mesa = any (string_to_array(m.grupo, '+'))) suma,
      (select count(*) from pzb.mesas x where x.activa and x.mesa = any (string_to_array(m.grupo, '+'))) n
    from pzb.mesas m where m.activa and m.grupo like '%+%' group by m.grupo
  ) g
  where g.n = cardinality(g.miembros) and cardinality(g.miembros) >= 2
$$;

-- La mesa (o unión) libre más ajustada al grupo; si empatan, la suelta y la de mínimo más alto
create or replace function pzb.elegir_mesa(f date, p_ini int, p_fin int, p_personas int, excluir text) returns text
language sql stable as $$
  select o.id from pzb.opciones() o
  where o.capacidad >= p_personas and p_personas >= o.minimo
    and not exists (select 1 from pzb.ocupacion(f, excluir) oc
                    where oc.ini < p_fin and p_ini < oc.fin and oc.mesas && o.miembros)
  order by o.capacidad, o.es_union, o.minimo desc, o.id
  limit 1
$$;

-- Capacidad del servicio = máximo de personas con reserva a la vez
create or replace function pzb.cabe(p_cap int, f date, p_ini int, p_fin int, p_personas int, excluir text) returns boolean
language sql stable as $$
  with oc as (select * from pzb.ocupacion(f, excluir)),
  pts as (select p_ini p union select oc.ini from oc where oc.ini > p_ini and oc.ini < p_fin)
  select not exists (
    select 1 from pts
    where (select coalesce(sum(oc.personas), 0) from oc where oc.ini <= pts.p and pts.p < oc.fin) + p_personas > p_cap)
$$;

create or replace function pzb.horarios(f date, p_personas int, antelacion int)
returns table (servicio text, hora text, mesa text) language plpgsql stable as $$
declare s pzb.servicios; h text; v_ini int; v_m text;
  es_hoy boolean := f = pzb.hoy();
  ahora_min int := pzb.minutos(to_char(pzb.ahora(), 'HH24:MI'));
begin
  for s in select * from pzb.servicios order by orden, servicio loop
    if not pzb.abierto(s, f) then continue; end if;
    foreach h in array s.horas loop
      v_ini := pzb.minutos(h);
      if es_hoy and v_ini < ahora_min + coalesce(antelacion, 0) then continue; end if;
      if not pzb.cabe(s.capacidad, f, v_ini, v_ini + s.duracion, p_personas, null) then continue; end if;
      v_m := pzb.elegir_mesa(f, v_ini, v_ini + s.duracion, p_personas, null);
      if v_m is null then continue; end if;
      servicio := s.servicio; hora := h; mesa := v_m;
      return next;
    end loop;
  end loop;
end $$;

/* ------------------------------------------------------------
 *  PÁGINA PÚBLICA
 * ------------------------------------------------------------ */

create or replace function pzb.validar_fecha_web(f date) returns text language sql stable as $$
  select case
    when f is null then 'Fecha no válida'
    when f < pzb.hoy() then 'Esa fecha ya ha pasado'
    when f > pzb.hoy() + coalesce(nullif(pzb.cfg('diasAntelacion'), '')::int, 60) then 'Todavía no se puede reservar para esa fecha'
    else '' end
$$;

create or replace function pzb.pub_servicios() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'ok', true,
    'hoy', pzb.txt_f(pzb.hoy()),
    'servicios', (select coalesce(jsonb_agg(jsonb_build_object('servicio', servicio, 'activo', activo, 'dias', to_jsonb(dias)) order by orden), '[]') from pzb.servicios),
    'aperturas', (select coalesce(jsonb_object_agg(pzb.txt_f(fecha), valores), '{}') from pzb.aperturas where fecha >= pzb.hoy()),
    'config', jsonb_build_object(
      'nombre', pzb.cfg('nombre', 'Pizzburger'), 'subtitulo', pzb.cfg('subtitulo'),
      'logo', case when pzb.cfg('logo') like 'https://%' then pzb.cfg('logo') else '' end,
      'telefono', pzb.cfg('telefono'), 'direccion', pzb.cfg('direccion'),
      'condiciones', pzb.cfg('condiciones'), 'privacidad', pzb.cfg('privacidad'),
      'diasAntelacion', coalesce(nullif(pzb.cfg('diasAntelacion'), '')::int, 60),
      'maxPersonasWeb', coalesce(nullif(pzb.cfg('maxPersonasWeb'), '')::int, 10)))
$$;

create or replace function pzb.pub_horarios(p jsonb) returns jsonb language plpgsql stable as $$
declare f date := pzb.fecha_ok(p ->> 'fecha'); v text; maxp int := coalesce(nullif(pzb.cfg('maxPersonasWeb'), '')::int, 10);
  antel int := coalesce(nullif(pzb.cfg('minutosAntelacion'), '')::int, 0); n int; por jsonb := '{}'; pers int;
begin
  v := pzb.validar_fecha_web(f);
  if v <> '' then return jsonb_build_object('ok', false, 'error', v); end if;
  if coalesce(p ->> 'todas', '') = 'true' then
    for n in 1..maxp loop
      por := por || jsonb_build_object(n::text, (select coalesce(jsonb_agg(jsonb_build_object('servicio', h.servicio, 'hora', h.hora)), '[]') from pzb.horarios(f, n, antel) h));
    end loop;
    return jsonb_build_object('ok', true, 'fecha', pzb.txt_f(f), 'porPersonas', por);
  end if;
  pers := nullif(p ->> 'personas', '')::int;
  if pers is null or pers < 1 or pers > maxp then return jsonb_build_object('ok', false, 'error', 'Número de personas no válido'); end if;
  return jsonb_build_object('ok', true, 'fecha', pzb.txt_f(f), 'personas', pers,
    'slots', (select coalesce(jsonb_agg(jsonb_build_object('servicio', h.servicio, 'hora', h.hora)), '[]') from pzb.horarios(f, pers, antel) h));
end $$;

create or replace function pzb.pub_reservar(p jsonb) returns jsonb language plpgsql volatile as $$
declare r pzb.reservas; f date := pzb.fecha_ok(p ->> 'fecha'); v text; v_mesa text;
  maxp int := coalesce(nullif(pzb.cfg('maxPersonasWeb'), '')::int, 10);
begin
  if coalesce(p ->> 'web', '') <> '' then -- campo trampa anti-bots
    return jsonb_build_object('ok', true, 'reservaId', 'x');
  end if;
  v := pzb.validar_fecha_web(f);
  if v <> '' then return jsonb_build_object('ok', false, 'error', v); end if;
  r.fecha := f;
  r.hora := pzb.norm_hora(p ->> 'hora');
  r.servicio := pzb.limpiar(p ->> 'servicio', 40);
  r.personas := coalesce(nullif(regexp_replace(coalesce(p ->> 'personas', ''), '\D', '', 'g'), '')::int, 0);
  r.nombre := pzb.limpiar(p ->> 'nombre', 60);
  r.apellidos := pzb.limpiar(p ->> 'apellidos', 80);
  r.email := '';
  r.telefono := pzb.limpiar(p ->> 'telefono', 30);
  r.alergias := pzb.limpiar(p ->> 'alergias', 500);
  if r.personas < 1 or r.personas > maxp then return jsonb_build_object('ok', false, 'error', 'Número de personas no válido'); end if;
  if r.nombre = '' or r.apellidos = '' then return jsonb_build_object('ok', false, 'error', 'Escribe tu nombre y apellidos'); end if;
  if length(regexp_replace(r.telefono, '\D', '', 'g')) < 9 then return jsonb_build_object('ok', false, 'error', 'El teléfono no parece correcto'); end if;

  perform pg_advisory_xact_lock(hashtext('pzb_reservas_' || f::text));

  -- Misma reserva repetida (mismo teléfono, día y hora). Nunca se devuelve el código de la
  -- reserva existente: con él se puede cancelar, y el teléfono de otra persona no es secreto.
  if exists (select 1 from pzb.reservas x
             where x.fecha = f and x.hora = r.hora and x.estado = any (pzb.activas())
               and right(regexp_replace(x.telefono, '\D', '', 'g'), 9) = right(regexp_replace(r.telefono, '\D', '', 'g'), 9)) then
    return jsonb_build_object('ok', false, 'error', 'Ya hay una reserva con ese teléfono a esa hora. Si quieres cambiarla o cancelarla, llámanos.');
  end if;

  select h.mesa into v_mesa from pzb.horarios(f, r.personas, coalesce(nullif(pzb.cfg('minutosAntelacion'), '')::int, 0)) h
    where h.hora = r.hora and h.servicio = r.servicio limit 1;
  if v_mesa is null then return jsonb_build_object('ok', false, 'error', 'Esa hora acaba de ocuparse. Elige otra, por favor.'); end if;

  insert into pzb.reservas (id, fecha, hora, servicio, personas, mesa, nombre, apellidos, email, telefono, alergias, estado, origen)
  values (pzb.nuevo_id(), r.fecha, r.hora, r.servicio, r.personas, v_mesa, r.nombre, r.apellidos, r.email, r.telefono, r.alergias, 'Confirmada', 'web')
  returning * into r;
  perform pzb.auditar(r.id, 'Creada', '', pzb.resumen(r), 'web');
  -- El código de cancelación solo se entrega aquí, a quien acaba de reservar
  return jsonb_build_object('ok', true, 'reservaId', r.id, 'codigo', r.codigo);
end $$;

create or replace function pzb.reserva_con_codigo(p jsonb) returns pzb.reservas language sql stable as $$
  select * from pzb.reservas
  where id = coalesce(p ->> 'id', '') and coalesce(p ->> 'codigo', '') ~ '^[a-f0-9]{64}$' and codigo = p ->> 'codigo'
$$;

create or replace function pzb.ya_pasada(r pzb.reservas) returns boolean language sql stable as
$$ select (r.fecha + coalesce(nullif(pzb.norm_hora(r.hora), ''), '23:59')::time) < pzb.ahora() $$;

create or replace function pzb.pub_ver(p jsonb) returns jsonb language plpgsql stable as $$
declare r pzb.reservas := pzb.reserva_con_codigo(p);
begin
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'No encontramos esa reserva. Revisa el enlace de cancelación.'); end if;
  return jsonb_build_object('ok', true, 'reserva', jsonb_build_object(
    'fecha', pzb.txt_f(r.fecha), 'hora', r.hora, 'personas', r.personas, 'nombre', r.nombre, 'estado', r.estado,
    'cancelable', r.estado = any (pzb.activas()) and not pzb.ya_pasada(r)));
end $$;

create or replace function pzb.pub_cancelar(p jsonb) returns jsonb language plpgsql volatile as $$
declare r pzb.reservas := pzb.reserva_con_codigo(p); antes text;
begin
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'No encontramos esa reserva. Revisa el enlace de cancelación.'); end if;
  select * into r from pzb.reservas where id = r.id for update;
  if r.estado = 'Cancelada' then return jsonb_build_object('ok', true, 'yaCancelada', true); end if;
  if not (r.estado = any (pzb.activas())) or pzb.ya_pasada(r) then
    return jsonb_build_object('ok', false, 'error', 'Esta reserva ya no se puede cancelar.');
  end if;
  antes := r.estado;
  update pzb.reservas set estado = 'Cancelada', actualizada = pzb.ahora() where id = r.id returning * into r;
  perform pzb.auditar(r.id, 'Cancelada por el cliente', antes, 'Cancelada', 'web');
  return jsonb_build_object('ok', true);
end $$;

/* ------------------------------------------------------------
 *  PANEL
 * ------------------------------------------------------------ */

create or replace function pzb.rol_actual() returns text language plpgsql stable as $$
declare e text;
begin
  begin e := lower(coalesce(auth.jwt() ->> 'email', ''));
  exception when others then e := ''; end;
  if e = '' then return null; end if;
  return (select rol from pzb.personal where email = e);
end $$;

create or replace function pzb.panel_datos(p_rol text) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'ok', true, 'rol', p_rol, 'hoy', pzb.txt_f(pzb.hoy()),
    'reservas', (select coalesce(jsonb_agg(pzb.reserva_json(r) order by r.fecha, r.hora), '[]') from pzb.reservas r),
    'mesas', (select coalesce(jsonb_agg(jsonb_build_object(
        'mesa', m.mesa, 'activa', m.activa, 'capacidad', m.capacidad, 'minimo', m.minimo, 'forma', m.forma,
        'x', m.x, 'y', m.y, 'zona', m.zona, 'grupo', m.grupo, 'capacidadGrupo', coalesce(m.capacidad_grupo, 0)) order by m.orden, m.mesa), '[]')
      from pzb.mesas m),
    'servicios', (select coalesce(jsonb_agg(jsonb_build_object(
        'servicio', s.servicio, 'activo', s.activo, 'dias', to_jsonb(s.dias), 'horas', to_jsonb(s.horas),
        'duracion', s.duracion, 'capacidad', s.capacidad) order by s.orden, s.servicio), '[]')
      from pzb.servicios s),
    'aperturas', (select coalesce(jsonb_object_agg(pzb.txt_f(a.fecha), a.valores), '{}') from pzb.aperturas a),
    'config', pzb.config_json(),
    'clientes', (select coalesce(jsonb_agg(jsonb_build_object(
        'clave', c.clave, 'nombre', c.nombre, 'apellidos', c.apellidos, 'email', c.email, 'telefono', c.telefono,
        'telefono2', c.telefono2, 'primera', pzb.txt_f(c.primera), 'ultima', pzb.txt_f(c.ultima),
        'reservas', c.reservas, 'personas', c.personas, 'noVino', c.no_vino, 'suscrito', c.suscrito,
        'empresa', c.empresa, 'notas', c.notas, 'origen', c.origen)), '[]')
      from pzb.clientes c))
$$;

create or replace function pzb.panel_sugerir_mesa(p jsonb) returns jsonb language plpgsql stable as $$
declare f date := pzb.fecha_ok(p ->> 'fecha'); h text := pzb.norm_hora(p ->> 'hora'); s pzb.servicios; v_ini int;
begin
  if f is null or h = '' then return jsonb_build_object('ok', true, 'mesa', ''); end if;
  s := pzb.servicio_de_hora(h);
  v_ini := pzb.minutos(h);
  return jsonb_build_object('ok', true, 'mesa', coalesce(pzb.elegir_mesa(f, v_ini, v_ini + coalesce(s.duracion, 90),
    greatest(1, coalesce(nullif(p ->> 'personas', '')::int, 1)), nullif(p ->> 'id', '')), ''));
end $$;

create or replace function pzb.panel_guardar_reserva(p jsonb, p_rol text) returns jsonb language plpgsql volatile as $$
declare e jsonb := coalesce(p -> 'reserva', '{}'); r pzb.reservas; antes pzb.reservas; s pzb.servicios;
  v_ini int; v_fin int; v_mesa text; avisos jsonb := '[]'; choques text[] := '{}';
  forzar boolean := coalesce((p ->> 'forzar')::boolean, false); o record; es_nueva boolean;
begin
  es_nueva := coalesce(e ->> 'id', '') = '';
  if not es_nueva then
    select * into antes from pzb.reservas where id = e ->> 'id';
    if not found then return jsonb_build_object('ok', false, 'error', 'No se encuentra esa reserva'); end if;
    r := antes;
  else
    r.id := pzb.nuevo_id(); r.origen := 'panel'; r.estado := 'Confirmada';
    r.codigo := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    r.creada := pzb.ahora();
  end if;
  r.fecha := pzb.fecha_ok(e ->> 'fecha');
  r.hora := pzb.norm_hora(e ->> 'hora');
  r.personas := coalesce(nullif(regexp_replace(coalesce(e ->> 'personas', ''), '\D', '', 'g'), '')::int, 0);
  r.nombre := pzb.limpiar(e ->> 'nombre', 60);
  r.apellidos := pzb.limpiar(e ->> 'apellidos', 80);
  r.email := lower(pzb.limpiar(e ->> 'email', 120));
  r.telefono := pzb.limpiar(e ->> 'telefono', 30);
  r.alergias := pzb.limpiar(e ->> 'alergias', 500);
  r.notas := pzb.limpiar(e ->> 'notas', 500);
  if coalesce(e ->> 'estado', '') = any (pzb.estados()) then r.estado := e ->> 'estado'; end if;
  if r.fecha is null then return jsonb_build_object('ok', false, 'error', 'Fecha no válida'); end if;
  if r.hora = '' then return jsonb_build_object('ok', false, 'error', 'Hora no válida'); end if;
  if r.personas < 1 or r.personas > 200 then return jsonb_build_object('ok', false, 'error', 'Número de personas no válido'); end if;
  if r.nombre = '' then return jsonb_build_object('ok', false, 'error', 'Falta el nombre'); end if;
  if r.email <> '' and not pzb.email_ok(r.email) then return jsonb_build_object('ok', false, 'error', 'El correo no parece correcto'); end if;

  perform pg_advisory_xact_lock(hashtext('pzb_reservas_' || r.fecha::text));

  s := pzb.servicio_de_hora(r.hora);
  r.servicio := coalesce(s.servicio, r.servicio, '');
  v_ini := pzb.minutos(r.hora);
  v_fin := v_ini + coalesce(s.duracion, 90);

  v_mesa := trim(coalesce(e ->> 'mesa', ''));
  if v_mesa = 'auto' then
    v_mesa := coalesce(pzb.elegir_mesa(r.fecha, v_ini, v_fin, r.personas, r.id), '');
    if v_mesa = '' and r.estado = any (pzb.activas()) then
      avisos := avisos || to_jsonb('No hay ninguna mesa libre que encaje; la reserva queda sin mesa.'::text);
    end if;
  end if;
  r.mesa := v_mesa;

  if r.estado = any (pzb.activas()) and not forzar then
    for o in select * from pzb.ocupacion(r.fecha, r.id) oc
             where oc.ini < v_fin and v_ini < oc.fin
               and oc.mesas && array(select trim(x) from unnest(string_to_array(v_mesa, '+')) x where trim(x) <> '')
    loop
      choques := choques || ('mesa ' || array_to_string(o.mesas, '+') || ' ocupada por ' || o.nombre || ' a las ' || o.hora);
    end loop;
    if s.servicio is not null and not pzb.cabe(s.capacidad, r.fecha, v_ini, v_fin, r.personas, r.id) then
      choques := choques || ('se supera la capacidad del servicio (' || s.capacidad || ' personas a la vez)');
    end if;
    if s.servicio is not null and not pzb.abierto(s, r.fecha) then
      choques := choques || ('ese día el servicio de ' || lower(s.servicio) || ' está cerrado');
    end if;
    if cardinality(choques) > 0 then
      return jsonb_build_object('ok', false, 'conflicto', true, 'error', 'Atención: ' || array_to_string(choques, '; ') || '.');
    end if;
  end if;

  r.actualizada := pzb.ahora();
  if not es_nueva then
    update pzb.reservas set fecha = r.fecha, hora = r.hora, servicio = r.servicio, personas = r.personas, mesa = r.mesa,
      nombre = r.nombre, apellidos = r.apellidos, email = r.email, telefono = r.telefono, alergias = r.alergias,
      notas = r.notas, estado = r.estado, actualizada = r.actualizada
    where id = r.id returning * into r;
    perform pzb.auditar(r.id, 'Editada', pzb.resumen(antes), pzb.resumen(r), 'panel (' || p_rol || ')');
  else
    insert into pzb.reservas values (r.*) returning * into r;
    perform pzb.auditar(r.id, 'Creada', '', pzb.resumen(r), 'panel (' || p_rol || ')');
  end if;

  return jsonb_build_object('ok', true, 'reserva', pzb.reserva_json(r), 'avisos', avisos);
end $$;

create or replace function pzb.panel_cambiar_estado(p jsonb, p_rol text) returns jsonb language plpgsql volatile as $$
declare r pzb.reservas; antes text; v_estado text := coalesce(p ->> 'estado', '');
begin
  if not (v_estado = any (pzb.estados())) then return jsonb_build_object('ok', false, 'error', 'Estado no válido'); end if;
  select * into r from pzb.reservas where id = coalesce(p ->> 'id', '') for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No se encuentra esa reserva'); end if;
  antes := r.estado;
  update pzb.reservas set estado = v_estado, actualizada = pzb.ahora() where id = r.id returning * into r;
  perform pzb.auditar(r.id, 'Cambio de estado', antes, v_estado, 'panel (' || p_rol || ')');
  return jsonb_build_object('ok', true, 'reserva', pzb.reserva_json(r));
end $$;

create or replace function pzb.panel_auditoria() returns jsonb language sql stable as $$
  select jsonb_build_object('ok', true, 'auditoria', coalesce((
    select jsonb_agg(jsonb_build_object('fecha', pzb.txt_ts(a.fecha), 'reserva', a.reserva, 'accion', a.accion,
      'antes', a.antes, 'despues', a.despues, 'origen', a.origen) order by a.id desc)
    from (select * from pzb.auditoria order by id desc limit 400) a), '[]'))
$$;

create or replace function pzb.panel_guardar_servicios(p jsonb, p_rol text) returns jsonb language plpgsql volatile as $$
declare s jsonb; i int := 0; nombres text[] := '{}'; v_nombre text; v_horas text[];
begin
  if jsonb_typeof(p -> 'servicios') <> 'array' or jsonb_array_length(p -> 'servicios') = 0 then
    return jsonb_build_object('ok', false, 'error', 'No hay servicios');
  end if;
  for s in select * from jsonb_array_elements(p -> 'servicios') loop
    i := i + 1;
    v_nombre := pzb.limpiar(s ->> 'servicio', 40);
    v_horas := pzb.horas_lista(s -> 'horas');
    if v_nombre = '' then raise exception 'Falta el nombre de un servicio'; end if;
    if cardinality(v_horas) = 0 then raise exception 'Pon al menos una hora en %', v_nombre; end if;
    nombres := nombres || v_nombre;
    insert into pzb.servicios (servicio, activo, dias, horas, duracion, capacidad, orden)
    values (v_nombre, coalesce((s ->> 'activo')::boolean, false),
      coalesce((select array_agg(distinct d::int order by d::int) from jsonb_array_elements_text(coalesce(s -> 'dias', '[]')) d where d ~ '^[0-6]$'), '{}'),
      v_horas, greatest(15, coalesce(nullif(s ->> 'duracion', '')::int, 90)), greatest(1, coalesce(nullif(s ->> 'capacidad', '')::int, 40)), i)
    on conflict (servicio) do update set activo = excluded.activo, dias = excluded.dias, horas = excluded.horas,
      duracion = excluded.duracion, capacidad = excluded.capacidad, orden = excluded.orden;
  end loop;
  delete from pzb.servicios where not (servicio = any (nombres));
  perform pzb.auditar('', 'Servicios modificados', '', (select string_agg(servicio || ' ' || array_to_string(horas, ','), ' | ') from pzb.servicios), 'panel (' || p_rol || ')');
  return jsonb_build_object('ok', true);
end $$;

create or replace function pzb.panel_guardar_mesas(p jsonb, p_rol text) returns jsonb language plpgsql volatile as $$
declare m jsonb; i int := 0; vistos text[] := '{}'; v_id text;
begin
  if jsonb_typeof(p -> 'mesas') <> 'array' then return jsonb_build_object('ok', false, 'error', 'Faltan las mesas'); end if;
  delete from pzb.mesas;
  for m in select * from jsonb_array_elements(p -> 'mesas') loop
    i := i + 1;
    v_id := pzb.limpiar(m ->> 'mesa', 10);
    if v_id = '' then raise exception 'Hay una mesa sin número'; end if;
    if v_id = any (vistos) then raise exception 'La mesa % está repetida', v_id; end if;
    vistos := vistos || v_id;
    insert into pzb.mesas (mesa, activa, capacidad, minimo, forma, x, y, zona, grupo, capacidad_grupo, orden)
    values (v_id, coalesce((m ->> 'activa')::boolean, false),
      greatest(1, coalesce(nullif(m ->> 'capacidad', '')::numeric::int, 1)), greatest(1, coalesce(nullif(m ->> 'minimo', '')::numeric::int, 1)),
      case when m ->> 'forma' = 'redonda' then 'redonda' else 'rectangular' end,
      least(95, greatest(0, coalesce(nullif(m ->> 'x', '')::numeric, 0))), least(95, greatest(0, coalesce(nullif(m ->> 'y', '')::numeric, 0))),
      coalesce(nullif(pzb.limpiar(m ->> 'zona', 30), ''), 'sala'), replace(pzb.limpiar(m ->> 'grupo', 30), ' ', ''),
      nullif(coalesce(nullif(m ->> 'capacidadGrupo', '')::numeric::int, 0), 0), i);
  end loop;
  perform pzb.auditar('', 'Mesas modificadas', '', i || ' mesas', 'panel (' || p_rol || ')');
  return jsonb_build_object('ok', true, 'mesas', pzb.panel_datos(p_rol) -> 'mesas');
end $$;

create or replace function pzb.panel_guardar_apertura(p jsonb, p_rol text) returns jsonb language plpgsql volatile as $$
declare f date := pzb.fecha_ok(p ->> 'fecha'); v jsonb := '{}'; k text; val jsonb;
begin
  if f is null then return jsonb_build_object('ok', false, 'error', 'Fecha no válida'); end if;
  if coalesce((p ->> 'quitar')::boolean, false) then
    delete from pzb.aperturas where fecha = f;
    perform pzb.auditar('', 'Día ' || pzb.txt_f(f) || ' vuelve al horario normal', '', '', 'panel (' || p_rol || ')');
  else
    for k, val in select * from jsonb_each(coalesce(p -> 'valores', '{}')) loop
      v := v || jsonb_build_object(lower(k), coalesce((val #>> '{}')::boolean, false));
    end loop;
    insert into pzb.aperturas (fecha, valores) values (f, v)
      on conflict (fecha) do update set valores = pzb.aperturas.valores || excluded.valores;
    perform pzb.auditar('', 'Apertura ' || pzb.txt_f(f), '', v::text, 'panel (' || p_rol || ')');
  end if;
  return jsonb_build_object('ok', true, 'aperturas', (select coalesce(jsonb_object_agg(pzb.txt_f(fecha), valores), '{}') from pzb.aperturas));
end $$;

create or replace function pzb.panel_guardar_config(p jsonb, p_rol text) returns jsonb language plpgsql volatile as $$
declare k text; v text;
  permitidas text[] := array['nombre', 'subtitulo', 'logo', 'telefono', 'direccion', 'condiciones', 'privacidad',
    'diasAntelacion', 'minutosAntelacion', 'maxPersonasWeb'];
begin
  for k, v in select key, value from jsonb_each_text(coalesce(p -> 'config', '{}')) loop
    if not (k = any (permitidas)) then continue; end if;
    v := left(coalesce(v, ''), case when k in ('condiciones', 'privacidad') then 20000 else 1000 end);
    if k = 'logo' and v <> '' and v not like 'https://%' then raise exception 'El logo debe ser una dirección que empiece por https://'; end if;
    if k in ('diasAntelacion', 'minutosAntelacion', 'maxPersonasWeb') and v !~ '^\d{1,4}$' then raise exception 'Revisa el número de «%»', k; end if;
    insert into pzb.config (clave, valor) values (k, v) on conflict (clave) do update set valor = excluded.valor;
  end loop;
  perform pzb.auditar('', 'Personalización guardada', '', '', 'panel (' || p_rol || ')');
  return jsonb_build_object('ok', true, 'config', pzb.config_json());
end $$;

create or replace function pzb.panel_importar_clientes(p jsonb, p_rol text) returns jsonb language plpgsql volatile as $$
declare x jsonb; v_clave text; prev pzb.clientes; nuevos int := 0; actualizados int := 0; saltados int := 0;
  v_nombre text; v_apellidos text; v_email text; v_tel text; v_susc text;
begin
  if jsonb_typeof(p -> 'filas') <> 'array' or jsonb_array_length(p -> 'filas') = 0 then
    return jsonb_build_object('ok', false, 'error', 'El archivo no tiene filas');
  end if;
  for x in select * from jsonb_array_elements(p -> 'filas') loop
    v_nombre := pzb.limpiar(x ->> 'nombre', 80); v_apellidos := pzb.limpiar(x ->> 'apellidos', 100);
    v_email := lower(pzb.limpiar(x ->> 'email', 120)); v_tel := pzb.limpiar(x ->> 'telefono', 30);
    v_clave := pzb.clave_cliente(v_email, v_tel, trim(v_nombre || ' ' || v_apellidos));
    if v_clave = '' then saltados := saltados + 1; continue; end if;
    select * into prev from pzb.clientes where clave = v_clave;
    if found then actualizados := actualizados + 1; else nuevos := nuevos + 1; end if;
    v_susc := case when coalesce(x ->> 'suscrito', '') = '' then coalesce(prev.suscrito, '')
                   when x ->> 'suscrito' ~* '^(s|si|sí|yes|true|1|x)$' then 'si' else 'no' end;
    insert into pzb.clientes as c (clave, nombre, apellidos, email, telefono, telefono2, primera, ultima, reservas, personas, no_vino, suscrito, empresa, notas, origen)
    values (v_clave,
      coalesce(nullif(v_nombre, ''), prev.nombre, ''), coalesce(nullif(v_apellidos, ''), prev.apellidos, ''),
      coalesce(nullif(v_email, ''), prev.email, ''), coalesce(nullif(v_tel, ''), prev.telefono, ''),
      coalesce(nullif(pzb.limpiar(x ->> 'telefono2', 30), ''), prev.telefono2, ''),
      coalesce(pzb.fecha_flexible(x ->> 'primera'), prev.primera), coalesce(pzb.fecha_flexible(x ->> 'ultima'), prev.ultima),
      coalesce(nullif(nullif(regexp_replace(coalesce(x ->> 'reservas', ''), '\D', '', 'g'), ''), '0')::int, prev.reservas, 0),
      coalesce(nullif(nullif(regexp_replace(coalesce(x ->> 'personas', ''), '\D', '', 'g'), ''), '0')::int, prev.personas, 0),
      coalesce(nullif(nullif(regexp_replace(coalesce(x ->> 'noVino', ''), '\D', '', 'g'), ''), '0')::int, prev.no_vino, 0),
      v_susc, coalesce(nullif(pzb.limpiar(x ->> 'empresa', 100), ''), prev.empresa, ''),
      coalesce(nullif(pzb.limpiar(x ->> 'notas', 1000), ''), prev.notas, ''), 'vento')
    on conflict (clave) do update set nombre = excluded.nombre, apellidos = excluded.apellidos, email = excluded.email,
      telefono = excluded.telefono, telefono2 = excluded.telefono2, primera = excluded.primera, ultima = excluded.ultima,
      reservas = excluded.reservas, personas = excluded.personas, no_vino = excluded.no_vino, suscrito = excluded.suscrito,
      empresa = excluded.empresa, notas = excluded.notas, origen = excluded.origen;
    prev := null;
  end loop;
  perform pzb.auditar('', 'Clientes importados', '', nuevos || ' nuevos, ' || actualizados || ' actualizados', 'panel (' || p_rol || ')');
  return jsonb_build_object('ok', true, 'nuevos', nuevos, 'actualizados', actualizados, 'saltados', saltados,
    'total', (select count(*) from pzb.clientes));
end $$;

create or replace function pzb.panel_importar_reservas(p jsonb, p_rol text) returns jsonb language plpgsql volatile as $$
declare x jsonb; f date; h text; v_id text; v_estado text; n int := 0; saltadas int := 0; s pzb.servicios;
begin
  if jsonb_typeof(p -> 'filas') <> 'array' or jsonb_array_length(p -> 'filas') = 0 then
    return jsonb_build_object('ok', false, 'error', 'El archivo no tiene filas');
  end if;
  for x in select * from jsonb_array_elements(p -> 'filas') loop
    f := pzb.fecha_flexible(x ->> 'fecha'); h := pzb.norm_hora(x ->> 'hora');
    if f is null or h = '' then saltadas := saltadas + 1; continue; end if;
    v_id := 'V' || left(regexp_replace(coalesce(nullif(trim(x ->> 'id'), ''),
      pzb.txt_f(f) || h || coalesce(x ->> 'email', '') || coalesce(x ->> 'telefono', '') || coalesce(x ->> 'nombre', '')), '[^A-Za-z0-9]', '', 'g'), 40);
    v_estado := (select e from unnest(pzb.estados()) e where lower(e) = lower(trim(coalesce(x ->> 'estado', ''))) limit 1);
    if v_estado is null then
      v_estado := case when coalesce(x ->> 'estado', '') ~* 'cancel' then 'Cancelada'
                       when coalesce(x ->> 'estado', '') ~* 'no.?pres|no.?show' then 'No presentado'
                       when f < pzb.hoy() then 'Finalizada' else 'Confirmada' end;
    end if;
    s := pzb.servicio_de_hora(h);
    insert into pzb.reservas (id, fecha, hora, servicio, personas, mesa, nombre, apellidos, email, telefono, alergias, notas, estado, origen)
    values (v_id, f, h, coalesce(s.servicio, ''),
      greatest(1, coalesce(nullif(regexp_replace(coalesce(x ->> 'personas', ''), '\D', '', 'g'), '')::int, 1)),
      pzb.limpiar(x ->> 'mesa', 20), pzb.limpiar(x ->> 'nombre', 60), pzb.limpiar(x ->> 'apellidos', 80),
      lower(pzb.limpiar(x ->> 'email', 120)), pzb.limpiar(x ->> 'telefono', 30), pzb.limpiar(x ->> 'alergias', 500),
      pzb.limpiar(x ->> 'notas', 500), v_estado, 'vento')
    on conflict (id) do nothing;
    if found then n := n + 1; else saltadas := saltadas + 1; end if;
  end loop;
  perform pzb.auditar('', 'Reservas importadas', '', n || ' importadas', 'panel (' || p_rol || ')');
  return jsonb_build_object('ok', true, 'importadas', n, 'saltadas', saltadas);
end $$;

/* ------------------------------------------------------------
 *  PUERTAS DE ENTRADA (las únicas accesibles desde la web)
 * ------------------------------------------------------------ */

create or replace function public.publico(p jsonb) returns jsonb
language plpgsql security definer set search_path = pzb, public, extensions as $$
declare a text := coalesce(p ->> 'accion', '');
begin
  return case a
    when 'servicios' then pzb.pub_servicios()
    when 'horarios' then pzb.pub_horarios(p)
    when 'reservar' then pzb.pub_reservar(p)
    when 'verReserva' then pzb.pub_ver(p)
    when 'cancelar' then pzb.pub_cancelar(p)
    else jsonb_build_object('ok', false, 'error', 'Acción desconocida') end;
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end $$;

create or replace function public.panel(p jsonb) returns jsonb
language plpgsql security definer set search_path = pzb, public, extensions as $$
declare a text := coalesce(p ->> 'accion', ''); v_rol text := pzb.rol_actual();
begin
  if v_rol is null then
    return jsonb_build_object('ok', false, 'sesion', false, 'error', 'Sesión caducada o usuario sin permiso. Vuelve a entrar.');
  end if;
  if a in ('auditoria', 'guardarServicios', 'guardarMesas', 'guardarApertura', 'guardarConfig',
           'importarClientes', 'importarReservas') and v_rol <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'Esta opción necesita el acceso de administración.');
  end if;
  return case a
    when 'yo' then jsonb_build_object('ok', true, 'rol', v_rol)
    when 'datos' then pzb.panel_datos(v_rol)
    when 'guardarReserva' then pzb.panel_guardar_reserva(p, v_rol)
    when 'cambiarEstado' then pzb.panel_cambiar_estado(p, v_rol)
    when 'sugerirMesa' then pzb.panel_sugerir_mesa(p)
    when 'auditoria' then pzb.panel_auditoria()
    when 'guardarServicios' then pzb.panel_guardar_servicios(p, v_rol)
    when 'guardarMesas' then pzb.panel_guardar_mesas(p, v_rol)
    when 'guardarApertura' then pzb.panel_guardar_apertura(p, v_rol)
    when 'guardarConfig' then pzb.panel_guardar_config(p, v_rol)
    when 'importarClientes' then pzb.panel_importar_clientes(p, v_rol)
    when 'importarReservas' then pzb.panel_importar_reservas(p, v_rol)
    else jsonb_build_object('ok', false, 'error', 'Acción desconocida') end;
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end $$;

revoke all on function public.publico(jsonb) from public;
revoke all on function public.panel(jsonb) from public;
do $$ begin
  execute 'grant execute on function public.publico(jsonb) to anon, authenticated';
  execute 'grant execute on function public.panel(jsonb) to authenticated';
exception when undefined_object then null; end $$;

-- Que la API vea los cambios al momento
notify pgrst, 'reload schema';
