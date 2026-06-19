const nodemailer = require('nodemailer');

// Configurar transporter para Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'comunisolve@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD // Contraseña de aplicación
    }
});

module.exports = transporter;