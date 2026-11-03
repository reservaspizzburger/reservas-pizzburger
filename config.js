/* Conexión con Supabase (la usan index.html y admin.html).
 * La URL y la clave "anon/publishable" son públicas por diseño: la seguridad
 * está en la base de datos (solo se puede llamar a publico() y panel()). */
window.PZB_CONFIG = {
  SUPABASE_URL: 'https://qmkrkqsnvlsjdfrdejxk.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFta3JrcXNudmxzamRmcmRlanhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MjA5ODAsImV4cCI6MjEwOTI5Njk4MH0.THCJUMjLsjuAWPyvlBpp6_DUsA0XaryMifx3-Vcb-cc',
  // Usuarios del panel (creados en Supabase → Authentication → Users)
  USUARIOS: { equipo: 'equipo@pizzburger.app', admin: 'admin@pizzburger.app' }
};
