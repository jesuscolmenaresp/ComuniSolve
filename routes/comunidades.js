const express = require('express');
const router = express.Router();
const comunidadController = require('../controllers/comunidadController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ========== RUTAS PARA UBCH (rol 1) y SUPERADMIN (rol 5) ==========

// Listar comunidades activas
router.get('/comunidades', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  comunidadController.listar
);

// Listar comunidades inactivas
router.get('/comunidades/inactivos', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  comunidadController.listarInactivas
);

// Formulario crear comunidad
router.get('/comunidades/nueva', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  comunidadController.formCrear
);

// Guardar nueva comunidad
router.post('/comunidades', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  comunidadController.crear
);

// Formulario editar comunidad
router.get('/comunidades/:id/editar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  comunidadController.formEditar
);

// Actualizar comunidad
router.post('/comunidades/:id/editar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  comunidadController.actualizar
);

// DESACTIVAR comunidad (soft delete)
router.post('/comunidades/:id/desactivar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  comunidadController.desactivar
);

// ACTIVAR comunidad (reactivar)
router.post('/comunidades/:id/activar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  comunidadController.activar
);

// ELIMINAR FÍSICAMENTE (solo SuperAdmin)
router.post('/comunidades/:id/destruir', 
  authMiddleware, 
  roleMiddleware([5]), 
  comunidadController.destruir
);

// Asignar comunidades a UBCH
router.post('/comunidades/asignar-ubch', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.asignarUBCH
);

router.get('/comunidades/ubch/:ubch_id', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.getComunidadesUBCH
);

module.exports = router;