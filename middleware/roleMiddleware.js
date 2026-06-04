// Middleware que permite acceso solo si el usuario tiene el rol correcto
// El SuperAdministrador (rol 5) tiene acceso a TODO automáticamente
module.exports = (rolesPermitidos) => {
  return (req, res, next) => {
    console.log('🔐 [roleMiddleware] Usuario en sesión:', req.session.usuario);
    console.log('🔐 [roleMiddleware] Roles permitidos:', rolesPermitidos);
    
    if (!req.session.usuario) {
      console.log('❌ [roleMiddleware] No hay usuario en sesión, redirigiendo a /login');
      return res.redirect('/login');
    }

    const usuarioRol = req.session.usuario.rol_id;
    
    // 🔑 SUPERADMINISTRADOR (rol 5) tiene acceso a TODO
    if (usuarioRol === 5) {
      console.log('👑 [roleMiddleware] SuperAdministrador detectado, acceso concedido automáticamente');
      return next();
    }

    if (!rolesPermitidos.includes(usuarioRol)) {
      console.log(`❌ [roleMiddleware] Rol ${usuarioRol} no autorizado`);
      return res.status(403).send("🚫 No tienes permisos para acceder a esta página.");
    }

    console.log('✅ [roleMiddleware] Acceso permitido');
    next();
  };
};