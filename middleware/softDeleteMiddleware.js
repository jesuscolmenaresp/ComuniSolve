// middleware/softDeleteMiddleware.js
const db = require('../models/db');

/**
 * Middleware para filtrar solo registros activos en consultas
 * Uso: router.get('/ruta', softDeleteMiddleware.filtrarActivos('usuarios'), controlador)
 */

// Filtro para consultas SELECT
exports.filtrarActivos = (tabla, alias = 't') => {
  return (req, res, next) => {
    // Guardar el filtro en req para usarlo en los controladores
    req.softDeleteFilter = `${alias}.activo = 1`;
    next();
  };
};

// Obtener todos (incluyendo inactivos) - solo para SuperAdmin
exports.obtenerConInactivos = (req, res, next) => {
  req.softDeleteFilter = null; // Sin filtro, trae todos
  next();
};