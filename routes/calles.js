const express = require('express');
const router = express.Router();
const calleController = require('../controllers/calleController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ========== RUTAS PARA UBCH (rol 1), LÍDER (rol 2) y SUPERADMIN (rol 5) ==========

// Listar calles activas
router.get('/calles', authMiddleware, roleMiddleware([1, 2, 5]), calleController.listarCalles);

// Listar calles inactivas (UBCH y SuperAdmin)
router.get('/calles/inactivos', authMiddleware, roleMiddleware([1, 5]), calleController.listarCallesInactivas);

// Formulario crear calle
router.get('/calles/nueva', authMiddleware, roleMiddleware([1, 5]), calleController.formCrear);

// Guardar nueva calle
router.post('/calles/nueva', authMiddleware, roleMiddleware([1, 5]), calleController.crear);

// Formulario editar calle
router.get('/calles/:id/editar', authMiddleware, roleMiddleware([1, 5]), calleController.formEditar);

// Actualizar calle
router.post('/calles/:id/editar', authMiddleware, roleMiddleware([1, 5]), calleController.actualizar);

// DESACTIVAR calle (soft delete)
router.post('/calles/:id/desactivar', authMiddleware, roleMiddleware([1, 5]), calleController.desactivar);

// ACTIVAR calle (reactivar)
router.post('/calles/:id/activar', authMiddleware, roleMiddleware([1, 5]), calleController.activar);

// ELIMINAR FÍSICAMENTE (solo SuperAdmin)
router.post('/calles/:id/destruir', authMiddleware, roleMiddleware([5]), calleController.destruir);

module.exports = router;