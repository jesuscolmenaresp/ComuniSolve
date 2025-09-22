const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const reporteController = require('../controllers/reporteController');
const upload = require('../middleware/uploadMiddleware'); // 👈 nuevo

// Listar reportes
router.get('/reportes', authMiddleware, reporteController.listarReportes);

// Formulario de reporte
router.get('/reportar', authMiddleware, reporteController.mostrarFormulario);

// Guardar reporte con imagen
router.post('/reportar', authMiddleware, upload.single("imagen"), reporteController.guardarReporte);

router.post('/reportes/:id/estado', authMiddleware, reporteController.cambiarEstado);

module.exports = router;
