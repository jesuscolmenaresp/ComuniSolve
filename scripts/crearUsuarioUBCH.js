const bcrypt = require('bcryptjs');
const db = require('../models/db');

async function crearUBCH() {
  const passwordPlano = '123456';
  const hash = await bcrypt.hash(passwordPlano, 10);

  try {
    await db.query(`
      DELETE FROM usuarios WHERE email = 'ubch@comuni.ve'
    `);

    await db.query(`
      INSERT INTO usuarios (nombre, email, password, telefono, rol_id, mostrar_nombre)
      VALUES (?, ?, ?, ?, ?, ?)`,
      ['UBCH Admin', 'ubch@comuni.ve', hash, '04140000001', 1, 1]
    );

    console.log('✅ Usuario UBCH creado exitosamente');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    process.exit();
  }
}

crearUBCH();
