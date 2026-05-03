const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// Configuración optimizada para Render
const poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

// Activar SSL en producción
if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolConfig);

// Probar conexión al iniciar
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error de conexión a la base de datos:', err.message);
    console.error('⚠️ Reintentando en 5 segundos...');
    setTimeout(() => {
      pool.getConnection((err2, conn2) => {
        if (err2) {
          console.error('❌ Error persistente de conexión:', err2.message);
        } else {
          console.log('✅ Conexión a la base de datos exitosa (reconexión)');
          conn2.release();
        }
      });
    }, 5000);
  } else {
    console.log('✅ Conexión a la base de datos exitosa');
    connection.release();
  }
});

// Manejar errores de conexión perdida
pool.on('error', (err) => {
  console.error('❌ Error en el pool de conexiones:', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('⚠️ Conexión perdida, reconectando...');
  }
});

module.exports = pool.promise();