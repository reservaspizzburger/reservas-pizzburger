/* Conexión con Supabase (la usan index.html y admin.html).
 * La URL y la clave "anon/publishable" son públicas por diseño: la seguridad
 * está en la base de datos (solo se puede llamar a publico() y panel()). */
window.PZB_CONFIG = {
  SUPABASE_URL: 'PEGAR_PROJECT_URL',
  SUPABASE_KEY: 'sb_publishable_CMwjnPBRPKw15XdRZh_L5g_FCP48Q4d',
  // Usuarios del panel (creados en Supabase → Authentication → Users)
  USUARIOS: { equipo: 'equipo@pizzburger.app', admin: 'admin@pizzburger.app' }
};
