// Middleware que permite acceso solo si el usuario tiene el rol correcto
module.exports = (rolesPermitidos) => {
  return (req, res, next) => {
    console.log('🔐 [roleMiddleware] Usuario en sesión:', req.session.usuario);
    console.log('🔐 [roleMiddleware] Roles permitidos:', rolesPermitidos);
    
    if (!req.session.usuario) {
      console.log('❌ [roleMiddleware] No hay usuario en sesión, redirigiendo a /login');
      return res.redirect('/login');
    }

    if (!rolesPermitidos.includes(req.session.usuario.rol_id)) {
      console.log(`❌ [roleMiddleware] Rol ${req.session.usuario.rol_id} no autorizado`);
      return res.status(403).send("🚫 No tienes permisos para acceder a esta página.");
    }

    console.log('✅ [roleMiddleware] Acceso permitido');
    next();
  };
};