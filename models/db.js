const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// Configuración para producción (Render) y desarrollo (local)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Probar conexión
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error de conexión a la base de datos:', err.message);
  } else {
    console.log('✅ Conexión a la base de datos exitosa');
    connection.release();
  }
});

module.exports = pool.promise();