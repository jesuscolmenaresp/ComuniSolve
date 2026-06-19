const express = require('express');
const router = express.Router();
const perfilController = require('../controllers/perfilController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadPerfil } = require('../middleware/uploadMiddleware');

// Todas las rutas requieren autenticación
router.get('/perfil', authMiddleware, perfilController.mostrarPerfil);
router.get('/perfil/editar', authMiddleware, perfilController.editarPerfil);

// Actualizar perfil con foto (multer)
router.post('/perfil/actualizar', 
  authMiddleware, 
  uploadPerfil.single('foto_perfil'), 
  perfilController.actualizarPerfil
);

router.get('/perfil/cambiar-password', authMiddleware, perfilController.cambiarPasswordForm);
router.post('/perfil/cambiar-password', authMiddleware, perfilController.cambiarPassword);

// Eliminar foto de perfil
router.get('/perfil/eliminar-foto', authMiddleware, perfilController.eliminarFoto);

module.exports = router;