const { Resend } = require('resend');

// Verificar que la API key existe
if (!process.env.RESEND_API_KEY) {
  console.error('❌ ERROR: RESEND_API_KEY no está definida en variables de entorno');
  console.log('⚠️ Los correos NO funcionarán. Agrega RESEND_API_KEY en tus variables de entorno');
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Email de origen (para pruebas, no requiere verificación de dominio)
// Si verificas tu dominio después, cambia por: hola@tudominio.com
const EMAIL_FROM = 'onboarding@resend.dev';

module.exports = { resend, EMAIL_FROM };