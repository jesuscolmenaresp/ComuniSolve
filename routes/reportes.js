const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const reporteController = require('../controllers/reporteController');
const upload = require('../middleware/uploadMiddleware');

// Listar reportes
router.get('/reportes', authMiddleware, reporteController.listarReportes);

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

module.exports = router;