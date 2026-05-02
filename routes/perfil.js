const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.get('/perfil', authMiddleware, perfilController.mostrarPerfil);
router.get('/perfil/editar', authMiddleware, perfilController.editarPerfil);
router.post('/perfil/actualizar', authMiddleware, perfilController.actualizarPerfil);
router.get('/perfil/cambiar-password', authMiddleware, perfilController.cambiarPasswordForm);
router.post('/perfil/cambiar-password', authMiddleware, perfilController.cambiarPassword);

module.exports = router;