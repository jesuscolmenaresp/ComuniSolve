const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { cargarConfiguracion } = require('../middleware/configMiddleware');

// Todas las rutas de configuración son públicas
router.get('/dark-mode', cargarConfiguracion, configController.getConfiguracion);
router.post('/dark-mode', cargarConfiguracion, configController.toggleDarkMode);
router.post('/mostrar-boton', cargarConfiguracion, configController.toggleMostrarBoton);

module.exports = router;