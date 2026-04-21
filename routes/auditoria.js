const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoriaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

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

module.exports = router;