const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Configuración del transporte de Gmail - VERSIÓN MEJORADA PARA RENDER
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,  // CAMBIAR de 465 a 587
  secure: false, // false para puerto 587 (STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Configuraciones adicionales para evitar timeouts
  connectionTimeout: 30000, // 30 segundos
  greetingTimeout: 30000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false // Solo para pruebas, en producción quitar
  }
});

// Verificar conexión (con manejo de errores)
transporter.verify()
  .then(() => {
    console.log('✅ Nodemailer listo para enviar correos usando Gmail SMTP');
  })
  .catch((err) => {
    console.error('❌ Error en configuración de Nodemailer:', err.message);
    console.log('⚠️ Los correos no funcionarán. Verifica:');
    console.log('   1. EMAIL_USER y EMAIL_PASS en variables de entorno');
    console.log('   2. Que la contraseña de aplicación sea correcta');
    console.log('   3. Render permite conexiones salientes al puerto 587');
  });

module.exports = transporter;