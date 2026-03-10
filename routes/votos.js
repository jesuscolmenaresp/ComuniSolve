const express = require('express');
const router = express.Router();
const votoController = require('../controllers/votoController');
const authMiddleware = require('../middleware/authMiddleware');

// 📌 Votar por un reporte (solo ciudadanos autenticados)
router.post('/reportes/:reporteId/votar', 
    authMiddleware, 
    votoController.votar
);

module.exports = router;