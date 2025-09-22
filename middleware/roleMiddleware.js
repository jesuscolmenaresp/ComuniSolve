// Middleware que permite acceso solo si el usuario tiene el rol correcto
module.exports = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.session.usuario) {
      return res.redirect('/login'); // si no hay sesión, redirige
    }

    if (!rolesPermitidos.includes(req.session.usuario.rol_id)) {
      return res.status(403).send("🚫 No tienes permisos para acceder a esta página.");
    }

    next(); // si todo está bien, sigue a la ruta
  };
};
