const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoriaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const exportController = require('../controllers/exportController');

// Solo UBCH puede ver auditoría
router.get('/auditoria', 
    authMiddleware, 
    roleMiddleware([1]), 
    auditoriaController.listar
);

router.get('/auditoria/detalle/:id', 
    authMiddleware, 
    roleMiddleware([1]), 
    auditoriaController.detalle
);

router.post('/auditoria/limpiar', 
    authMiddleware, 
    roleMiddleware([1]), 
    auditoriaController.limpiar
);

router.get('/auditoria/exportar/excel', authMiddleware, roleMiddleware([1]), exportController.exportarAuditoriaExcel);

router.get('/auditoria/exportar/pdf', authMiddleware, roleMiddleware([1]), exportController.exportarAuditoriaPDF);

module.exports = router;