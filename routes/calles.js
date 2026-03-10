// routes/calles.js
const express = require('express');
const router = express.Router();
const calleController = require('../controllers/calleController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Listar calles (UBCH y líderes)
router.get('/calles', authMiddleware, roleMiddleware([1, 2]), calleController.listarCalles);

// Formulario crear calle (solo UBCH)
router.get('/calles/nueva', authMiddleware, roleMiddleware([1]), calleController.formCrear);

// Guardar nueva calle (solo UBCH)
router.post('/calles/nueva', authMiddleware, roleMiddleware([1]), calleController.crear);

// Formulario editar calle (solo UBCH)
router.get('/calles/:id/editar', authMiddleware, roleMiddleware([1]), calleController.formEditar);

// Actualizar calle (solo UBCH)
router.post('/calles/:id/editar', authMiddleware, roleMiddleware([1]), calleController.actualizar);

module.exports = router;