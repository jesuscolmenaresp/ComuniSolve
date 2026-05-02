const express = require('express');
const router = express.Router();
const voluntarioController = require('../controllers/voluntarioController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const exportController = require('../controllers/exportController');
const db = require('../models/db');

// 📌 Redirigir según si ya es voluntario o no
router.get('/voluntarios', authMiddleware, async (req, res) => {
    try {
        const [existe] = await db.query(
            'SELECT id, estado FROM voluntarios WHERE usuario_id = ?',
            [req.session.usuario.id]
        );
        
        // Si ya es voluntario (aprobado, pendiente o rechazado), ir a mi perfil
        if (existe.length > 0) {
            return res.redirect('/voluntarios/mi-perfil');
        }
        
        // Si no, mostrar formulario de registro
        voluntarioController.mostrarFormulario(req, res);
    } catch (err) {
        console.error(err);
        res.redirect('/voluntarios/mi-perfil');
    }
});

// 📌 Página pública para ver voluntarios aprobados
router.get('/voluntarios/publico', voluntarioController.listarVoluntariosPublicos);

// 📌 Mi perfil de voluntario
router.get('/voluntarios/mi-perfil', authMiddleware, voluntarioController.miPerfil);

// 📌 Formulario para editar (solo si ya es voluntario) - CORREGIDO
router.get('/voluntarios/editar', authMiddleware, voluntarioController.mostrarEdicion);

// 📌 Guardar/actualizar registro
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

// 📌 Responder a asignación (voluntario)
router.post('/voluntarios/asignacion/:id/responder', 
    authMiddleware, 
    voluntarioController.responderAsignacion
);

// 📌 Asignar voluntario a reporte (UBCH/Líder)
router.post('/voluntarios/asignar-reporte', 
    authMiddleware, 
    roleMiddleware([1, 2]), 
    voluntarioController.asignarVoluntarioReporte
);

// 📌 API: Obtener voluntarios aprobados (para asignación)
router.get('/api/voluntarios/aprobados', 
    authMiddleware, 
    roleMiddleware([1, 2]), 
    voluntarioController.getVoluntariosAprobados
);

// 📌 Cambiar estado de voluntario (aprobado/rechazado)
router.post('/voluntarios/:id/cambiar-estado', 
    authMiddleware, 
    roleMiddleware([1, 2]), 
    voluntarioController.cambiarEstadoVoluntario
);

// Exportar voluntarios (solo UBCH)
router.get('/voluntarios/exportar/excel', authMiddleware, roleMiddleware([1]), exportController.exportarVoluntariosExcel);

module.exports = router;