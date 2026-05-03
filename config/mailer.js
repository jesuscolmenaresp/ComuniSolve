const nodemailer = require('nodemailer');
const { getAccessToken } = require('./oauth2');
const dotenv = require('dotenv');

dotenv.config();

// Función para crear transporter con token fresco
async function createTransporter() {
  try {
    const accessToken = await getAccessToken();
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken,
      },
      connectionTimeout: 30000,
      socketTimeout: 30000,
    });

    return transporter;
  } catch (error) {
    console.error('❌ Error creando transporter:', error.message);
    throw error;
  }
}

// Crear una instancia inicial (se renovará automáticamente)
let transporterPromise = createTransporter();

// Verificar cada 50 minutos (antes de que expire el token de 1 hora)
setInterval(async () => {
  try {
    transporterPromise = createTransporter();
    const transporter = await transporterPromise;
    await transporter.verify();
    console.log('✅ Token de acceso renovado correctamente');
  } catch (error) {
    console.error('❌ Error renovando token:', error.message);
  }
}, 50 * 60 * 1000);

// Verificación inicial
transporterPromise.then(async (transporter) => {
  try {
    await transporter.verify();
    console.log('✅ Nodemailer con OAuth2 listo para enviar correos');
  } catch (error) {
    console.error('❌ Error en configuración de correo:', error.message);
  }
}).catch(err => {
  console.error('❌ Error inicializando email:', err.message);
});

module.exports = async () => {
  return await transporterPromise;
};