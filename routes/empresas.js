const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// ========== RUTAS PARA UBCH (rol 1) y SUPERADMIN (rol 5) ==========

// Listar empresas activas
router.get('/empresas', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    empresaController.listar
);

// Listar empresas inactivas
router.get('/empresas/inactivos', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    empresaController.listarInactivas
);

// Formulario crear empresa
router.get('/empresas/nueva', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    empresaController.formCrear
);

// Guardar nueva empresa
router.post('/empresas', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    empresaController.crear
);

// Formulario editar empresa
router.get('/empresas/:id/editar', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    empresaController.formEditar
);

// Actualizar empresa
router.post('/empresas/:id/editar', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    empresaController.actualizar
);

// DESACTIVAR empresa (soft delete)
router.post('/empresas/:id/desactivar', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    empresaController.desactivar
);

// ACTIVAR empresa (reactivar)
router.post('/empresas/:id/activar', 
    authMiddleware, 
    roleMiddleware([1, 5]), 
    empresaController.activar
);

// ELIMINAR FÍSICAMENTE (solo SuperAdmin)
router.post('/empresas/:id/destruir', 
    authMiddleware, 
    roleMiddleware([5]), 
    empresaController.destruir
);

// API pública (para cargar empresas por categoría)
router.get('/api/empresas/categoria/:categoriaId', empresaController.porCategoria);

module.exports = router;