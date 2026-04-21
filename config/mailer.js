const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Configuración del transporte de Gmail
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true para puerto 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verificar conexión
transporter.verify().then(() => {
  console.log('✅ Nodemailer listo para enviar correos');
}).catch((err) => {
  console.error('❌ Error en configuración de Nodemailer:', err);
});

module.exports = transporter;