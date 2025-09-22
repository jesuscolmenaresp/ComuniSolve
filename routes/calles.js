// routes/calles.js
const express = require('express');
const router = express.Router();
const calleController = require('../controllers/calleController');
const roleMiddleware = require('../middleware/roleMiddleware');

// 📌 Listar calles → solo UBCH y Líder
router.get('/calles', roleMiddleware([1, 2]), calleController.listarCalles);

// 📌 Formulario para crear calle → solo UBCH y Líder
router.get('/calles/nueva', roleMiddleware([1, 2]), calleController.formCrear);

// 📌 Guardar nueva calle → solo UBCH y Líder
router.post('/calles/nueva', roleMiddleware([1, 2]), calleController.crear);

module.exports = router;
