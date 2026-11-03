// Función de Supabase que envía los correos de reservas desde Gmail.
// La llama la base de datos (pg_net) con la clave compartida CLAVE_CORREO.
// Secretos (los pone GitHub al desplegar): CLAVE_CORREO, GMAIL_USER, GMAIL_APP_PASSWORD.

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { construir } from './plantillas.ts';

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true, app: 'Correos Reservas Pizzburger' });

  let d: { clave?: string; tipo?: string; reserva?: Record<string, unknown>; config?: Record<string, string> } = {};
  try { d = await req.json(); } catch { return json({ ok: false, error: 'Petición no válida' }, 400); }

  const clave = Deno.env.get('CLAVE_CORREO') ?? '';
  if (!clave || d.clave !== clave) return json({ ok: false, error: 'Clave incorrecta' }, 401);

  const usuario = Deno.env.get('GMAIL_USER') ?? '';
  const pass = (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').replace(/\s/g, '');
  if (!usuario || !pass) return json({ ok: false, error: 'Falta configurar Gmail' }, 500);

  const config = d.config ?? {};
  const correo = construir(String(d.tipo ?? ''), (d.reserva ?? {}) as never, config);
  if (!correo) return json({ ok: false, error: 'Sin destinatario o tipo desconocido' });

  const cliente = new SMTPClient({
    connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: usuario, password: pass } },
  });
  try {
    await cliente.send({
      from: `${config.nombre || 'Pizzburger'} <${usuario}>`,
      to: correo.para,
      replyTo: correo.responderA || undefined,
      subject: correo.asunto,
      html: correo.html,
      content: 'Abre este correo en un programa que muestre HTML.',
    });
    return json({ ok: true });
  } catch (e) {
    console.error('Error enviando', d.tipo, e);
    return json({ ok: false, error: String(e) }, 500);
  } finally {
    try { await cliente.close(); } catch { /* ya cerrado */ }
  }
});
