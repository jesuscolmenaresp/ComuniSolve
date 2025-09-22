const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Vistas
router.get('/login', authController.mostrarLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

// (Opcional: Registro solo para ciudadanos)
router.get('/registro', authController.mostrarRegistro);
router.post('/registro', authController.registrar);

module.exports = router;
