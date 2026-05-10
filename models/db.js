const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// Configuración optimizada para Render + TiDB con timeouts
const poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 4000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,      // 10 segundos para conectar (evita cold starts eternos)
  acquireTimeout: 10000       // 10 segundos para adquirir conexión
};

// SSL para TiDB
if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolConfig);

// Eventos del pool para depuración (opcional)
pool.on('acquire', (connection) => {
  console.log('✅ Conexión adquirida del pool');
});

pool.on('release', (connection) => {
  console.log('🔄 Conexión liberada al pool');
});

pool.on('error', (err) => {
  console.error('❌ Error en el pool:', err.message);
});

// Probar conexión inicial
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error inicial de conexión a la BD:', err.message);
    console.error('⚠️ Verifica las variables de entorno DB_HOST, DB_USER, DB_PASSWORD');
  } else {
    console.log('✅ Pool de conexiones listo');
    connection.release();
  }
});

module.exports = pool.promise();