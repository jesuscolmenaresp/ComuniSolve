const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

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

// Crear usuario (UBCH y SuperAdmin)
router.post('/usuarios', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  usuarioController.crear
);

// Formulario editar (UBCH y SuperAdmin)
router.get('/usuarios/:id/editar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  usuarioController.formEditar
);

// Actualizar usuario (UBCH y SuperAdmin)
router.post('/usuarios/:id/editar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
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
router.post('/usuarios/:id/aprobar', authMiddleware, roleMiddleware([1, 2, 5]), usuarioController.aprobar);
router.post('/usuarios/:id/rechazar', authMiddleware, roleMiddleware([1, 2, 5]), usuarioController.rechazar);

// Reaprobar usuario (cambiar de rechazado a aprobado) - UBCH, Líder y SuperAdmin
router.post('/usuarios/:id/reaprobar', authMiddleware, roleMiddleware([1, 2, 5]), usuarioController.reaprobar);

module.exports = router;