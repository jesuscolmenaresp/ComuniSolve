const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const reporteController = require('../controllers/reporteController');
const { uploadReportes } = require('../middleware/uploadMiddleware');
const exportController = require('../controllers/exportController');

// 📌 Listar reportes (versión rápida)
router.get('/reportes', authMiddleware, reporteController.listarReportesRapido);

// Obtener detalle de reporte (para modal)
router.get('/reportes/:id/detalle', authMiddleware, reporteController.obtenerDetalle);

// Formulario de reporte
router.get('/reportar', authMiddleware, reporteController.mostrarFormulario);

// Guardar reporte con imagen
router.post('/reportar', authMiddleware, uploadReportes.single('imagen'), reporteController.guardarReporte);

// Cambiar estado
router.post('/reportes/:id/estado', authMiddleware, reporteController.cambiarEstado);

// Asignar empresa a reporte (UBCH, Líder y SuperAdmin)
router.post('/reportes/:id/asignar-empresa', 
  authMiddleware, 
  roleMiddleware([1, 2, 5]), 
  reporteController.asignarEmpresa
);

// Reportes de mi calle (para ciudadanos)
router.get('/reportes/mi-calle', authMiddleware, reporteController.reportesMiCalle);

// Exportar reportes (UBCH, Líder, Jefe y SuperAdmin)
router.get('/reportes/exportar/excel', authMiddleware, roleMiddleware([1, 2, 3, 5]), exportController.exportarReportesExcel);
router.get('/reportes/exportar/pdf', authMiddleware, roleMiddleware([1, 2, 3, 5]), exportController.exportarReportesPDF);

// Eliminar empresa asignada a un reporte (UBCH, Líder y SuperAdmin)
router.post('/reportes/:id/eliminar-empresa', 
  authMiddleware, 
  roleMiddleware([1, 2, 5]), 
  reporteController.eliminarEmpresa
);

// Eliminar voluntario asignado a un reporte (UBCH, Líder y SuperAdmin)
router.post('/reportes/:id/eliminar-voluntario', 
  authMiddleware, 
  roleMiddleware([1, 2, 5]), 
  reporteController.eliminarVoluntario
);

// ==========================
// 📌 REPORTES INACTIVOS
// ==========================
router.get('/reportes/inactivos', authMiddleware, roleMiddleware([1, 5]), reporteController.listarInactivos);
router.post('/reportes/:id/activar', authMiddleware, roleMiddleware([1, 5]), reporteController.activarReporte);
router.post('/reportes/:id/destruir', authMiddleware, roleMiddleware([5]), reporteController.destruirReporte);

// ==========================
// 📌 DESACTIVAR REPORTE (UBCH y SuperAdmin)
// ==========================
router.post('/reportes/:id/desactivar', 
  authMiddleware, 
  roleMiddleware([1, 5]), 
  reporteController.desactivarReporte
);

module.exports = router;