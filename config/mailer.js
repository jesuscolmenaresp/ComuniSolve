const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Configuración ESPECÍFICA para Render con Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Configuración que hace que funcione en Render
  pool: true,
  maxConnections: 1,
  rateDelta: 1000,
  rateLimit: 5,
  socketTimeout: 60000,
  connectionTimeout: 60000,
});

// Verificar conexión (solo log, no bloquea)
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error en configuración de correo:', error.message);
    console.log('⚠️ Los correos no funcionarán. Verifica:');
    console.log('   1. EMAIL_USER y EMAIL_PASS en variables de entorno');
    console.log('   2. Contraseña de aplicación de Gmail SIN ESPACIOS');
    console.log('   3. Que la contraseña sea de "Aplicación" no la normal');
  } else {
    console.log('✅ Nodemailer listo para enviar correos');
  }
});

module.exports = transporter;