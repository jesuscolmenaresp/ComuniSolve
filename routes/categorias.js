const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ========== RUTAS PARA UBCH (rol 1) y SUPERADMIN (rol 5) ==========

// Listar categorías activas
router.get('/categorias', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    categoriaController.listar
);

// Listar categorías inactivas
router.get('/categorias/inactivos', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    categoriaController.listarInactivas
);

// Formulario crear categoría
router.get('/categorias/nueva', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    categoriaController.formCrear
);

// Guardar nueva categoría
router.post('/categorias', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    categoriaController.crear
);

// Formulario editar categoría
router.get('/categorias/:id/editar', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    categoriaController.formEditar
);

// Actualizar categoría
router.post('/categorias/:id/editar', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    categoriaController.actualizar
);

// DESACTIVAR categoría (soft delete)
router.post('/categorias/:id/desactivar', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    categoriaController.desactivar
);

// ACTIVAR categoría (reactivar)
router.post('/categorias/:id/activar', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    categoriaController.activar
);

// ELIMINAR FÍSICAMENTE (solo SuperAdmin)
router.post('/categorias/:id/destruir', 
    authMiddleware, 
    roleMiddleware([5]), 
    categoriaController.destruir
);

// API pública (para cargar categorías dinámicamente)
router.get('/api/categorias', categoriaController.getCategorias);

module.exports = router;