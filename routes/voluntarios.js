const express = require('express');
const router = express.Router();
const voluntarioController = require('../controllers/voluntarioController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// 📌 Página pública para ver voluntarios aprobados (accesible sin login)
router.get('/voluntarios/publico', voluntarioController.listarVoluntariosPublicos);

// 📌 Formulario para unirse (solo ciudadanos)
router.get('/voluntarios', authMiddleware, voluntarioController.mostrarFormulario);

// 📌 Guardar registro
router.post('/voluntarios', authMiddleware, voluntarioController.guardarVoluntario);

// 📌 Página de éxito
router.get('/voluntarios/exito', authMiddleware, voluntarioController.exito);

// 📌 Gestionar solicitudes (UBCH y líderes)
router.get('/voluntarios/gestionar', 
    authMiddleware, 
    roleMiddleware([1, 2]), 
    voluntarioController.gestionarSolicitudes
);

// 📌 Aprobar voluntario
router.post('/voluntarios/:id/aprobar', 
    authMiddleware, 
    roleMiddleware([1, 2]), 
    voluntarioController.aprobar
);

// 📌 Rechazar voluntario
router.post('/voluntarios/:id/rechazar', 
    authMiddleware, 
    roleMiddleware([1, 2]), 
    voluntarioController.rechazar
);

module.exports = router;