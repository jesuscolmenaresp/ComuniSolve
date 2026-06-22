const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { uploadPerfil } = require('../middleware/uploadMiddleware');

// ========== RUTAS PARA UBCH (rol 1) y SUPERADMIN (rol 5) ==========

// Listar usuarios activos (UBCH y SuperAdmin)
router.get('/usuarios', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  usuarioController.listar
);

// Listar usuarios inactivos (UBCH y SuperAdmin)
router.get('/usuarios/inactivos', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  usuarioController.listarInactivos
);

// Formulario crear usuario (UBCH y SuperAdmin)
router.get('/usuarios/nuevo', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  usuarioController.formCrear
);

// Crear usuario (UBCH y SuperAdmin) - CON FOTO DE PERFIL
// IMPORTANTE: uploadPerfil debe ir ANTES del controlador
router.post('/usuarios', 
  authMiddleware, 
  roleMiddleware([1, 5]),
  uploadPerfil.single('foto_perfil'), // ✅ Primero se procesa la imagen
  usuarioController.crear // ✅ Luego se ejecuta el controlador
);

// Formulario editar (UBCH y SuperAdmin)
router.get('/usuarios/:id/editar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  usuarioController.formEditar
);

// Actualizar usuario (UBCH y SuperAdmin) - CON FOTO DE PERFIL
router.post('/usuarios/:id/editar', 
  authMiddleware, 
  roleMiddleware([1, 5]),
  uploadPerfil.single('foto_perfil'),
  usuarioController.actualizar
);

// DESACTIVAR usuario (soft delete) - UBCH y SuperAdmin
router.post('/usuarios/:id/eliminar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  usuarioController.eliminar
);

// ACTIVAR usuario (reactivar) - UBCH y SuperAdmin
router.post('/usuarios/:id/activar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  usuarioController.activar
);

// ELIMINAR FÍSICAMENTE (solo SuperAdmin con motivo)
router.post('/usuarios/:id/destruir', 
  authMiddleware, 
  roleMiddleware([5]), 
  usuarioController.destruir
);

// Aprobar/Rechazar ciudadanos (UBCH, Líder y SuperAdmin)
router.post('/usuarios/:id/aprobar', 
  authMiddleware, 
  roleMiddleware([1, 2, 5]), 
  usuarioController.aprobar
);
router.post('/usuarios/:id/rechazar', 
  authMiddleware, 
  roleMiddleware([1, 2, 5]), 
  usuarioController.rechazar
);

// Reaprobar usuario (cambiar de rechazado a aprobado) - UBCH, Líder y SuperAdmin
router.post('/usuarios/:id/reaprobar', 
  authMiddleware, 
  roleMiddleware([1, 2, 5]), 
  usuarioController.reaprobar
);

// Eliminar foto de perfil (solo SuperAdmin y UBCH)
router.get('/usuarios/:id/eliminar-foto',
  authMiddleware,
  roleMiddleware([1, 5]),
  usuarioController.eliminarFoto
);

module.exports = router;