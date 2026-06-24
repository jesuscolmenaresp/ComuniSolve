const express = require('express');
const router = express.Router();
const notificacionController = require('../controllers/notificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ==========================
// 📌 API - Contar no leídas (DEBE ir ANTES de las rutas con parámetros)
// ==========================
router.get('/api/notificaciones/no-leidas', authMiddleware, notificacionController.contarNoLeidas);

// ==========================
// 📌 RUTAS PRINCIPALES
// ==========================
router.get('/notificaciones', authMiddleware, notificacionController.listar);

// Crear notificación (solo UBCH y SuperAdmin)
router.post('/notificaciones/crear', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    notificacionController.crear
);

// Marcar como leída
router.post('/notificaciones/:id/leer', authMiddleware, notificacionController.marcarLeida);

// Marcar todas como leídas
router.post('/notificaciones/leer-todas', authMiddleware, notificacionController.marcarTodasLeidas);

// Eliminar notificación
router.post('/notificaciones/:id/eliminar', authMiddleware, notificacionController.eliminar);

module.exports = router;