const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Todas las rutas de empresas solo para UBCH
router.get('/empresas', 
    authMiddleware, 
    roleMiddleware([1]), 
    empresaController.listar
);

router.get('/empresas/nueva', 
    authMiddleware, 
    roleMiddleware([1]), 
    empresaController.formCrear
);

router.post('/empresas', 
    authMiddleware, 
    roleMiddleware([1]), 
    empresaController.crear
);

router.get('/empresas/:id/editar', 
    authMiddleware, 
    roleMiddleware([1]), 
    empresaController.formEditar
);

router.post('/empresas/:id/editar', 
    authMiddleware, 
    roleMiddleware([1]), 
    empresaController.actualizar
);

router.post('/empresas/:id/eliminar', 
    authMiddleware, 
    roleMiddleware([1]), 
    empresaController.eliminar
);

// API pública (opcional)
router.get('/api/empresas/categoria/:categoria', empresaController.porCategoria);

module.exports = router;