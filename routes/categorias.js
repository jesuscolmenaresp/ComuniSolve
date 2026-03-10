const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Todas las rutas de categorías solo para UBCH
router.get('/categorias', 
    authMiddleware, 
    roleMiddleware([1]), 
    categoriaController.listar
);

router.get('/categorias/nueva', 
    authMiddleware, 
    roleMiddleware([1]), 
    categoriaController.formCrear
);

router.post('/categorias', 
    authMiddleware, 
    roleMiddleware([1]), 
    categoriaController.crear
);

router.get('/categorias/:id/editar', 
    authMiddleware, 
    roleMiddleware([1]), 
    categoriaController.formEditar
);

router.post('/categorias/:id/editar', 
    authMiddleware, 
    roleMiddleware([1]), 
    categoriaController.actualizar
);

router.post('/categorias/:id/eliminar', 
    authMiddleware, 
    roleMiddleware([1]), 
    categoriaController.eliminar
);

// API pública (para cargar categorías dinámicamente)
router.get('/api/categorias', categoriaController.getCategorias);

module.exports = router;