const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Configuración para Render que SÍ funciona
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // IMPORTANTE: true para puerto 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Timeouts más agresivos
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error en configuración de correo:', error.message);
    console.log('⚠️ Posibles soluciones:');
    console.log('   1. Verifica que la "Contraseña de aplicación" sea correcta');
    console.log('   2. En Gmail, permite "Acceso de aplicaciones menos seguras"? (ya no aplica)');
    console.log('   3. La cuenta necesita verificación en https://myaccount.google.com/security');
  } else {
    console.log('✅ Nodemailer listo para enviar correos');
  }
});

module.exports = transporter;