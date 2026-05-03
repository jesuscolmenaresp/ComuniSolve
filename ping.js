const https = require('https');

const URL = process.env.APP_URL || 'https://comunisolve.onrender.com';

function ping() {
  https.get(URL, (res) => {
    console.log(`✅ Ping a ${URL} - Estado: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`❌ Error al ping: ${err.message}`);
  });
}

// Ping cada 10 minutos
setInterval(ping, 10 * 60 * 1000);

// Ping inicial
ping();

console.log(`🔄 Servicio de ping activo para ${URL}`);