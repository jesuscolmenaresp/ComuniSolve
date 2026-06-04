const db = require('../models/db');
const fs = require('fs');
const path = require('path');

// Agregar al inicio, después de las importaciones
const asegurarDirectorioBackups = () => {
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    console.log('📁 Creando directorio de backups:', backupsDir);
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  return backupsDir;
};

// ==========================
// 📌 FUNCIONES AUXILIARES CORREGIDAS
// ==========================

// Obtener todas las tablas de la base de datos - VERSIÓN CORREGIDA
async function getTables() {
  try {
    // Usar SHOW TABLES que es más confiable que information_schema
    const [rows] = await db.query('SHOW TABLES');
    
    console.log('📋 SHOW TABLES resultado:', rows);
    
    // Extraer los nombres de las tablas (la clave puede variar)
    let tables = [];
    if (rows && rows.length > 0) {
      // La primera columna suele llamarse 'Tables_in_nombre_db'
      const firstKey = Object.keys(rows[0])[0];
      tables = rows.map(row => row[firstKey]);
    }
    
    console.log('📋 Tablas encontradas:', tables);
    
    if (tables.length === 0) {
      console.error('⚠️ No se encontraron tablas en la base de datos');
      // Intentar diagnóstico alternativo
      const [checkDb] = await db.query('SELECT DATABASE() as db');
      console.log('Base de datos actual:', checkDb[0].db);
    }
    
    return tables;
  } catch (error) {
    console.error('Error en getTables:', error);
    throw new Error(`No se pudo obtener la lista de tablas: ${error.message}`);
  }
}

// Escapar valores para SQL
function escapeValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  return `'${String(value).replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

// Obtener estructura de una tabla
async function getTableStructure(tableName) {
  if (!tableName || tableName === 'undefined' || tableName === '') {
    throw new Error(`Nombre de tabla inválido: ${tableName}`);
  }
  
  try {
    // Escapar el nombre de tabla correctamente
    const [rows] = await db.query(`SHOW CREATE TABLE \`${tableName.replace(/`/g, '``')}\``);
    if (!rows || rows.length === 0) {
      throw new Error(`No se encontró estructura para la tabla: ${tableName}`);
    }
    return rows[0]['Create Table'];
  } catch (error) {
    console.error(`Error al obtener estructura de ${tableName}:`, error.message);
    throw error;
  }
}

// Obtener datos de una tabla
async function getTableData(tableName) {
  if (!tableName || tableName === 'undefined' || tableName === '') {
    console.warn(`Nombre de tabla inválido: ${tableName}, omitiendo...`);
    return [];
  }
  
  try {
    const [rows] = await db.query(`SELECT * FROM \`${tableName.replace(/`/g, '``')}\``);
    return rows;
  } catch (error) {
    console.error(`Error al obtener datos de ${tableName}:`, error.message);
    return [];
  }
}

// Generar INSERTs a partir de datos
function generateInserts(tableName, data) {
  if (data.length === 0) return '';
  
  const columns = Object.keys(data[0]);
  const inserts = [];
  
  for (const row of data) {
    const values = columns.map(col => escapeValue(row[col]));
    inserts.push(`INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${values.join(', ')});`);
  }
  
  return inserts.join('\n');
}

// ==========================
// 📌 RESPALDO COMPLETO
// ==========================
exports.backupCompleto = async (req, res) => {
  try {
    console.log('🚀 Iniciando backup completo...');
    
    const tables = await getTables();
    
    if (tables.length === 0) {
      throw new Error('No hay tablas para respaldar. Verifica que la base de datos tenga tablas.');
    }
    
    let sql = `-- ============================================\n`;
    sql += `-- RESPALDO COMPLETO - COMUNISOLVE\n`;
    sql += `-- Fecha: ${new Date().toLocaleString()}\n`;
    sql += `-- Usuario: ${req.session.usuario?.nombre || 'Sistema'}\n`;
    sql += `-- ============================================\n\n`;
    
    sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
    
    for (const table of tables) {
      console.log(`📦 Procesando tabla: ${table}`);
      
      // Estructura
      const structure = await getTableStructure(table);
      sql += `-- ========== ESTRUCTURA: ${table} ==========\n`;
      sql += `${structure};\n\n`;
      
      // Datos
      const data = await getTableData(table);
      if (data.length > 0) {
        sql += `-- ========== DATOS: ${table} (${data.length} registros) ==========\n`;
        sql += generateInserts(table, data);
        sql += `\n\n`;
      }
    }
    
    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    
    // Crear nombre de archivo
    const fecha = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `backup_completo_${fecha}.sql`;
    const backupsDir = asegurarDirectorioBackups();
    const filepath = path.join(backupsDir, filename);
    
    // Guardar archivo
    fs.writeFileSync(filepath, sql, 'utf8');
    console.log(`✅ Backup guardado: ${filename} (${(fs.statSync(filepath).size / 1024).toFixed(2)} KB)`);
    
    // Registrar en auditoría
    const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
    await registrarAuditoria(
      req.session.usuario,
      'CREAR',
      'backup',
      null,
      null,
      { tipo: 'completo', archivo: filename }
    );
    
    req.session.mensaje = `✅ Backup "${filename}" creado exitosamente`;
    res.redirect('/superadmin/backups');
    
  } catch (err) {
    console.error('❌ Error en backupCompleto:', err);
    req.session.error = `Error al generar el respaldo: ${err.message}`;
    res.redirect('/dashboard/superadmin');
  }
};

// ==========================
// 📌 RESPALDO SOLO ESTRUCTURA
// ==========================
exports.backupEstructura = async (req, res) => {
  try {
    const tables = await getTables();
    
    if (tables.length === 0) {
      throw new Error('No hay tablas para respaldar');
    }
    
    let sql = `-- ============================================\n`;
    sql += `-- RESPALDO ESTRUCTURA - COMUNISOLVE\n`;
    sql += `-- Fecha: ${new Date().toLocaleString()}\n`;
    sql += `-- Usuario: ${req.session.usuario?.nombre || 'Sistema'}\n`;
    sql += `-- ============================================\n\n`;
    
    for (const table of tables) {
      const structure = await getTableStructure(table);
      sql += `${structure};\n\n`;
    }
    
    const fecha = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `backup_estructura_${fecha}.sql`;
    const backupsDir = asegurarDirectorioBackups();
    const filepath = path.join(backupsDir, filename);
    
    fs.writeFileSync(filepath, sql, 'utf8');
    console.log(`✅ Backup estructura guardado: ${filename}`);
    
    const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
    await registrarAuditoria(
      req.session.usuario,
      'CREAR',
      'backup',
      null,
      null,
      { tipo: 'estructura', archivo: filename }
    );
    
    req.session.mensaje = `✅ Backup de estructura "${filename}" creado exitosamente`;
    res.redirect('/superadmin/backups');
    
  } catch (err) {
    console.error('Error en backupEstructura:', err);
    req.session.error = `Error al generar el respaldo: ${err.message}`;
    res.redirect('/dashboard/superadmin');
  }
};

// ==========================
// 📌 RESPALDO SOLO DATOS
// ==========================
exports.backupDatos = async (req, res) => {
  try {
    const tables = await getTables();
    
    if (tables.length === 0) {
      throw new Error('No hay tablas para respaldar');
    }
    
    let sql = `-- ============================================\n`;
    sql += `-- RESPALDO DATOS - COMUNISOLVE\n`;
    sql += `-- Fecha: ${new Date().toLocaleString()}\n`;
    sql += `-- Usuario: ${req.session.usuario?.nombre || 'Sistema'}\n`;
    sql += `-- ============================================\n\n`;
    
    sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;
    
    for (const table of tables) {
      const data = await getTableData(table);
      if (data.length > 0) {
        sql += `-- ========== DATOS: ${table} (${data.length} registros) ==========\n`;
        sql += generateInserts(table, data);
        sql += `\n\n`;
      }
    }
    
    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    
    const fecha = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `backup_datos_${fecha}.sql`;
    const backupsDir = asegurarDirectorioBackups();
    const filepath = path.join(backupsDir, filename);
    
    fs.writeFileSync(filepath, sql, 'utf8');
    console.log(`✅ Backup datos guardado: ${filename}`);
    
    const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
    await registrarAuditoria(
      req.session.usuario,
      'CREAR',
      'backup',
      null,
      null,
      { tipo: 'datos', archivo: filename }
    );
    
    req.session.mensaje = `✅ Backup de datos "${filename}" creado exitosamente`;
    res.redirect('/superadmin/backups');
    
  } catch (err) {
    console.error('Error en backupDatos:', err);
    req.session.error = `Error al generar el respaldo: ${err.message}`;
    res.redirect('/dashboard/superadmin');
  }
};

// ==========================
// 📌 LISTAR RESPALDOS
// ==========================
exports.listarBackups = async (req, res) => {
  try {
    const backupsDir = asegurarDirectorioBackups();
    
    const files = fs.readdirSync(backupsDir);
    const backups = files
      .filter(file => file.endsWith('.sql'))
      .map(file => {
        const stats = fs.statSync(path.join(backupsDir, file));
        return {
          nombre: file,
          tamaño: (stats.size / 1024).toFixed(2) + ' KB',
          fecha: stats.mtime
        };
      })
      .sort((a, b) => b.fecha - a.fecha);
    
    res.render('superadmin/backups', {
      usuario: req.session.usuario,
      session: req.session,
      backups
    });
    
  } catch (err) {
    console.error('Error en listarBackups:', err);
    req.session.error = 'Error al listar los respaldos';
    res.redirect('/dashboard/superadmin');
  }
};

// ==========================
// 📌 DESCARGAR RESPALDO
// ==========================
exports.descargarBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const backupsDir = asegurarDirectorioBackups();
    const filepath = path.join(backupsDir, filename);
    
    if (!fs.existsSync(filepath)) {
      req.session.error = 'El archivo no existe';
      return res.redirect('/superadmin/backups');
    }
    
    res.download(filepath, filename);
    
  } catch (err) {
    console.error('Error en descargarBackup:', err);
    req.session.error = 'Error al descargar el respaldo';
    res.redirect('/superadmin/backups');
  }
};

// ==========================
// 📌 ELIMINAR RESPALDO
// ==========================
exports.eliminarBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const backupsDir = asegurarDirectorioBackups();
    const filepath = path.join(backupsDir, filename);
    
    if (!fs.existsSync(filepath)) {
      req.session.error = 'El archivo no existe';
      return res.redirect('/superadmin/backups');
    }
    
    fs.unlinkSync(filepath);
    
    const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
    await registrarAuditoria(
      req.session.usuario,
      'ELIMINAR',
      'backup',
      null,
      null,
      { archivo: filename }
    );
    
    req.session.mensaje = `Respaldo "${filename}" eliminado correctamente`;
    res.redirect('/superadmin/backups');
    
  } catch (err) {
    console.error('Error en eliminarBackup:', err);
    req.session.error = 'Error al eliminar el respaldo';
    res.redirect('/superadmin/backups');
  }
};
// Función de diagnóstico - Ejecutar una vez para ver qué está pasando
async function diagnosticarTablas() {
  try {
    console.log('=== DIAGNÓSTICO DE BASE DE DATOS ===');
    
    // 1. Verificar base de datos actual
    const [dbResult] = await db.query('SELECT DATABASE() as db');
    console.log('Base de datos actual:', dbResult[0].db);
    
    // 2. Listar todas las bases de datos
    const [dbs] = await db.query('SHOW DATABASES');
    console.log('Bases de datos disponibles:', dbs.map(d => Object.values(d)[0]));
    
    // 3. Intentar SHOW TABLES directamente
    const [tables] = await db.query('SHOW TABLES');
    console.log('SHOW TABLES resultado:', tables);
    
    // 4. Verificar información del schema
    const [info] = await db.query(`
      SELECT * FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      LIMIT 5
    `);
    console.log('Information schema (primeras 5):', JSON.stringify(info, null, 2));
    
    console.log('=== FIN DIAGNÓSTICO ===');
    
    return tables;
  } catch (error) {
    console.error('Error en diagnóstico:', error);
    return [];
  }
}