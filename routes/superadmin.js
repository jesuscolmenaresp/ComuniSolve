const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const backupController = require('../controllers/backupController');
const configController = require('../controllers/configController');

// ========== CONFIGURACIÓN (acceso público) ==========
// GET - obtener configuración (público)
router.get('/config/dark-mode', configController.getConfiguracion);

// POST - cambiar modo nocturno (PÚBLICO - cualquier usuario puede cambiar)
router.post('/config/dark-mode', configController.toggleDarkMode);

// POST - cambiar visibilidad del botón (SOLO SuperAdmin)
router.post('/config/mostrar-boton', configController.toggleMostrarBoton);

// ========== TODAS LAS DEMÁS RUTAS requieren rol 5 ==========
router.use(authMiddleware, roleMiddleware([5]));

// ========== RESPALDOS ==========
router.get('/backups', backupController.listarBackups);
router.get('/backup/completo', backupController.backupCompleto);
router.get('/backup/estructura', backupController.backupEstructura);
router.get('/backup/datos', backupController.backupDatos);
router.get('/backup/descargar/:filename', backupController.descargarBackup);
router.post('/backup/eliminar/:filename', backupController.eliminarBackup);

module.exports = router;