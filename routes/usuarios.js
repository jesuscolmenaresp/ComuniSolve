const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Todas las rutas de usuarios solo para UBCH (rol 1) y superadmin (rol 1 por ahora)
router.get('/usuarios', 
  authMiddleware, 
  roleMiddleware([1]), 
  usuarioController.listar
);

router.get('/usuarios/nuevo', 
  authMiddleware, 
  roleMiddleware([1]), 
  usuarioController.formCrear
);

router.post('/usuarios', 
  authMiddleware, 
  roleMiddleware([1]), 
  usuarioController.crear
);

router.get('/usuarios/:id/editar', 
  authMiddleware, 
  roleMiddleware([1]), 
  usuarioController.formEditar
);

router.post('/usuarios/:id/editar', 
  authMiddleware, 
  roleMiddleware([1]), 
  usuarioController.actualizar
);

router.post('/usuarios/:id/eliminar', 
  authMiddleware, 
  roleMiddleware([1]), 
  usuarioController.eliminar
);

module.exports = router;