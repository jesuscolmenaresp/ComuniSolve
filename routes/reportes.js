const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const reporteController = require('../controllers/reporteController');
const upload = require('../middleware/uploadMiddleware');
const exportController = require('../controllers/exportController');

// Listar reportes
router.get('/reportes', authMiddleware, reporteController.listarReportes);

// Obtener detalle de reporte (para modal)
router.get('/reportes/:id/detalle', authMiddleware, reporteController.obtenerDetalle);

// Formulario de reporte
router.get('/reportar', authMiddleware, reporteController.mostrarFormulario);

// Guardar reporte con imagen
router.post('/reportar', authMiddleware, upload.single('imagen'), reporteController.guardarReporte);

// Cambiar estado
router.post('/reportes/:id/estado', authMiddleware, reporteController.cambiarEstado);

// Asignar empresa a reporte (solo UBCH y Líder)
router.post('/reportes/:id/asignar-empresa', 
  authMiddleware, 
  roleMiddleware([1, 2]), 
  reporteController.asignarEmpresa
);

// 📌 Reportes de mi calle (para ciudadanos)
router.get('/reportes/mi-calle', authMiddleware, reporteController.reportesMiCalle);

// Exportar reportes
router.get('/reportes/exportar/excel', authMiddleware, roleMiddleware([1, 2]), exportController.exportarReportesExcel);
router.get('/reportes/exportar/pdf', authMiddleware, roleMiddleware([1, 2]), exportController.exportarReportesPDF);

// Exportar voluntarios (solo UBCH)
router.get('/voluntarios/exportar/excel', authMiddleware, roleMiddleware([1]), exportController.exportarVoluntariosExcel);

module.exports = router;