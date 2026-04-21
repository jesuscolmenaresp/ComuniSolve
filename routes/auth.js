const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passwordController = require('../controllers/passwordController'); // 👈 AGREGAR ESTA LÍNEA

// ==========================
// 📌 LOGIN
// ==========================
router.get('/login', authController.mostrarLogin);
router.post('/login', authController.login);

// ==========================
// 📌 REGISTRO
// ==========================
router.get('/registro', authController.mostrarRegistro);
router.post('/registro', authController.registrar);

// ==========================
// 📌 LOGOUT
// ==========================
router.get('/logout', authController.logout);

// ==========================
// 📌 RECUPERACIÓN DE CONTRASEÑA
// ==========================
router.get('/olvide-password', passwordController.mostrarOlvidePassword);
router.post('/olvide-password', passwordController.solicitarRecuperacion);
router.get('/reset-password/:token', passwordController.mostrarResetPassword);
router.post('/reset-password/:token', passwordController.procesarResetPassword);

module.exports = router;