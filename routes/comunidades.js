const express = require('express');
const router = express.Router();
const comunidadController = require('../controllers/comunidadController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Todas las rutas de comunidades solo para UBCH
router.get('/comunidades', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.listar
);

router.get('/comunidades/nueva', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.formCrear
);

router.post('/comunidades', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.crear
);

router.get('/comunidades/:id/editar', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.formEditar
);

router.post('/comunidades/:id/editar', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.actualizar
);

router.post('/comunidades/:id/eliminar', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.eliminar
);

// Asignar comunidades a UBCH
router.post('/comunidades/asignar-ubch', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.asignarUBCH
);

router.get('/comunidades/ubch/:ubch_id', 
  authMiddleware, 
  roleMiddleware([1]), 
  comunidadController.getComunidadesUBCH
);

module.exports = router;