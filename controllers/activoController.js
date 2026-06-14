const db = require('../models/db');

// ==========================
// 📌 ACTIVAR/DESACTIVAR REGISTROS
// ==========================

/**
 * Desactivar un registro (soft delete)
 * @param {string} tabla - Nombre de la tabla
 * @param {number} id - ID del registro
 * @param {number} usuarioId - ID del usuario que realiza la acción
 * @param {string} motivo - Motivo de la desactivación
 */
async function desactivarRegistro(tabla, id, usuarioId, motivo) {
  try {
    // Verificar que la tabla sea válida
    const tablasPermitidas = ['usuarios', 'reportes', 'voluntarios', 'calles', 'comunidades', 'empresas', 'categorias'];
    if (!tablasPermitidas.includes(tabla)) {
      throw new Error('Tabla no permitida');
    }
    
    // Obtener nombre del registro antes de desactivar
    let nombreCampo = 'nombre';
    if (tabla === 'reportes') nombreCampo = 'titulo';
    if (tabla === 'usuarios') nombreCampo = 'email';
    
    const [registro] = await db.query(`SELECT ${nombreCampo} FROM ${tabla} WHERE id = ?`, [id]);
    const nombreRegistro = registro[0]?.[nombreCampo] || `ID: ${id}`;
    
    // Desactivar
    await db.query(`UPDATE ${tabla} SET activo = 0 WHERE id = ?`, [id]);
    
    // Registrar en auditoría
    const { registrarAuditoria } = require('./auditoriaController');
    await registrarAuditoria(
      usuarioId,
      'DESACTIVAR',
      tabla,
      id,
      null,
      { motivo, nombre: nombreRegistro }
    );
    
    return { success: true, message: `Registro "${nombreRegistro}" desactivado correctamente` };
  } catch (error) {
    console.error(`Error al desactivar ${tabla}:`, error);
    return { success: false, message: error.message };
  }
}

/**
 * Activar un registro (reactivar soft delete)
 */
async function activarRegistro(tabla, id, usuarioId, motivo) {
  try {
    const tablasPermitidas = ['usuarios', 'reportes', 'voluntarios', 'calles', 'comunidades', 'empresas', 'categorias'];
    if (!tablasPermitidas.includes(tabla)) {
      throw new Error('Tabla no permitida');
    }
    
    let nombreCampo = 'nombre';
    if (tabla === 'reportes') nombreCampo = 'titulo';
    if (tabla === 'usuarios') nombreCampo = 'email';
    
    const [registro] = await db.query(`SELECT ${nombreCampo} FROM ${tabla} WHERE id = ?`, [id]);
    const nombreRegistro = registro[0]?.[nombreCampo] || `ID: ${id}`;
    
    await db.query(`UPDATE ${tabla} SET activo = 1 WHERE id = ?`, [id]);
    
    const { registrarAuditoria } = require('./auditoriaController');
    await registrarAuditoria(
      usuarioId,
      'ACTIVAR',
      tabla,
      id,
      null,
      { motivo, nombre: nombreRegistro }
    );
    
    return { success: true, message: `Registro "${nombreRegistro}" activado correctamente` };
  } catch (error) {
    console.error(`Error al activar ${tabla}:`, error);
    return { success: false, message: error.message };
  }
}

/**
 * Listar registros inactivos (para SuperAdmin)
 */
async function listarInactivos(tabla) {
  try {
    const tablasPermitidas = ['usuarios', 'reportes', 'voluntarios', 'calles', 'comunidades', 'empresas', 'categorias'];
    if (!tablasPermitidas.includes(tabla)) {
      throw new Error('Tabla no permitida');
    }
    
    const [rows] = await db.query(`SELECT * FROM ${tabla} WHERE activo = 0 ORDER BY id DESC`);
    return rows;
  } catch (error) {
    console.error(`Error al listar inactivos de ${tabla}:`, error);
    return [];
  }
}

// ==========================
// 📌 ENDPOINTS PARA SUPERADMIN
// ==========================

exports.desactivarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuarioId = req.session.usuario?.id;
    
    const resultado = await desactivarRegistro('usuarios', id, usuarioId, motivo || 'Desactivado por SuperAdmin');
    
    if (resultado.success) {
      req.session.mensaje = resultado.message;
    } else {
      req.session.error = resultado.message;
    }
    res.redirect('/usuarios');
  } catch (error) {
    req.session.error = 'Error al desactivar usuario';
    res.redirect('/usuarios');
  }
};

exports.activarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuarioId = req.session.usuario?.id;
    
    const resultado = await activarRegistro('usuarios', id, usuarioId, motivo || 'Activado por SuperAdmin');
    
    if (resultado.success) {
      req.session.mensaje = resultado.message;
    } else {
      req.session.error = resultado.message;
    }
    res.redirect('/usuarios');
  } catch (error) {
    req.session.error = 'Error al activar usuario';
    res.redirect('/usuarios');
  }
};

exports.usuariosInactivos = async (req, res) => {
  try {
    const inactivos = await listarInactivos('usuarios');
    res.render('superadmin/usuarios_inactivos', {
      usuario: req.session.usuario,
      session: req.session,
      usuarios: inactivos
    });
  } catch (error) {
    req.session.error = 'Error al cargar usuarios inactivos';
    res.redirect('/dashboard/superadmin');
  }
};

// Exportar funciones para usar en otros controladores
module.exports = {
  desactivarRegistro,
  activarRegistro,
  listarInactivos,
  desactivarUsuario,
  activarUsuario,
  usuariosInactivos
};