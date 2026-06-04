const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const backupController = require('../controllers/backupController');
const configController = require('../controllers/configController');

// Todas las rutas de SuperAdmin requieren rol 5
router.use(authMiddleware, roleMiddleware([5]));

// ========== RESPALDOS ==========
router.get('/backups', backupController.listarBackups);
router.get('/backup/completo', backupController.backupCompleto);
router.get('/backup/estructura', backupController.backupEstructura);
router.get('/backup/datos', backupController.backupDatos);
router.get('/backup/descargar/:filename', backupController.descargarBackup);
router.post('/backup/eliminar/:filename', backupController.eliminarBackup);

// ========== CONFIGURACIÓN ==========
router.get('/config/dark-mode', configController.getConfiguracion);
router.post('/config/dark-mode', configController.toggleDarkMode);

module.exports = router;