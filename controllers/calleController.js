const db = require('../models/db');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');

// ==========================
// 📌 LISTAR CALLES ACTIVAS
// ==========================
exports.listarCalles = async (req, res) => {
  try {
    const [calles] = await db.query(`
      SELECT c.*, 
             u.nombre AS jefe_nombre, 
             l.nombre AS lider_nombre,
             com.nombre AS comunidad_nombre
      FROM calles c
      LEFT JOIN usuarios u ON c.jefe_id = u.id
      LEFT JOIN usuarios l ON c.lider_id = l.id
      LEFT JOIN comunidades com ON c.comunidad_id = com.id
      WHERE c.activo = 1
      ORDER BY c.nombre ASC
    `);
    res.render("calles/listar", { 
      calles,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al listar calles");
  }
};

// ==========================
// 📌 LISTAR CALLES INACTIVAS
// ==========================
exports.listarCallesInactivas = async (req, res) => {
  try {
    if (!req.session.usuario || (req.session.usuario.rol_id !== 1 && req.session.usuario.rol_id !== 5)) {
      req.session.error = 'No autorizado';
      return res.redirect('/dashboard');
    }

    const [calles] = await db.query(`
      SELECT c.*, 
             u.nombre AS jefe_nombre, 
             l.nombre AS lider_nombre,
             com.nombre AS comunidad_nombre
      FROM calles c
      LEFT JOIN usuarios u ON c.jefe_id = u.id
      LEFT JOIN usuarios l ON c.lider_id = l.id
      LEFT JOIN comunidades com ON c.comunidad_id = com.id
      WHERE c.activo = 0
      ORDER BY c.nombre ASC
    `);
    
    res.render("calles/inactivos", { 
      calles,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al listar calles inactivas';
    res.redirect('/calles');
  }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE NUEVA CALLE
// ==========================
exports.formCrear = async (req, res) => {
  try {
    const [jefes] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 3 AND activo = 1");
    const [lideres] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 2 AND activo = 1");
    const [comunidades] = await db.query("SELECT id, nombre FROM comunidades WHERE activo = 1 ORDER BY nombre");
    
    res.render("calles/crear", { 
      jefes, 
      lideres,
      comunidades,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error cargando formulario");
  }
};

// ==========================
// 📌 GUARDAR NUEVA CALLE
// ==========================
exports.crear = async (req, res) => {
  const { nombre, jefe_id, lider_id, comunidad_id } = req.body;
  
  try {
    const [result] = await db.query(
      "INSERT INTO calles (nombre, jefe_id, lider_id, comunidad_id, activo) VALUES (?, ?, ?, ?, 1)",
      [nombre, jefe_id || null, lider_id || null, comunidad_id || null]
    );
    
    await registrarAuditoria(
      req.session.usuario,
      'CREAR',
      'calles',
      result.insertId,
      null,
      { nombre, jefe_id, lider_id, comunidad_id }
    );
    
    req.session.mensaje = 'Calle creada exitosamente';
    res.redirect("/calles");
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al crear calle';
    res.redirect("/calles/nueva");
  }
};

// ==========================
// 📌 FORMULARIO DE EDICIÓN
// ==========================
exports.formEditar = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [calle] = await db.query("SELECT * FROM calles WHERE id = ? AND activo = 1", [id]);
    const [jefes] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 3 AND activo = 1");
    const [lideres] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 2 AND activo = 1");
    const [comunidades] = await db.query("SELECT id, nombre FROM comunidades WHERE activo = 1 ORDER BY nombre");
    
    if (calle.length === 0) {
      return res.status(404).send("Calle no encontrada");
    }
    
    res.render("calles/editar", { 
      calle: calle[0],
      jefes, 
      lideres,
      comunidades,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar formulario de edición");
  }
};

// ==========================
// 📌 ACTUALIZAR CALLE
// ==========================
exports.actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, jefe_id, lider_id, comunidad_id } = req.body;
  
  try {
    const [calleAnterior] = await db.query("SELECT * FROM calles WHERE id = ?", [id]);
    
    await db.query(
      "UPDATE calles SET nombre = ?, jefe_id = ?, lider_id = ?, comunidad_id = ? WHERE id = ?",
      [nombre, jefe_id || null, lider_id || null, comunidad_id || null, id]
    );
    
    await registrarAuditoria(
      req.session.usuario,
      'EDITAR',
      'calles',
      id,
      calleAnterior[0],
      { nombre, jefe_id, lider_id, comunidad_id }
    );
    
    req.session.mensaje = 'Calle actualizada exitosamente';
    res.redirect("/calles");
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al actualizar calle';
    res.redirect(`/calles/${id}/editar`);
  }
};

// ==========================
// 📌 DESACTIVAR CALLE (SOFT DELETE)
// ==========================
exports.desactivar = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const [calleADesactivar] = await db.query(
      'SELECT nombre FROM calles WHERE id = ? AND activo = 1',
      [id]
    );

    if (calleADesactivar.length === 0) {
      req.session.error = 'Calle no encontrada o ya está inactiva';
      return res.redirect('/calles');
    }

    // Verificar si tiene reportes asociados ACTIVOS
    const [reportesAsociados] = await db.query(
      'SELECT COUNT(*) as total FROM reportes WHERE calle_id = ? AND activo = 1',
      [id]
    );

    if (reportesAsociados[0].total > 0) {
      req.session.error = `No se puede desactivar la calle porque tiene ${reportesAsociados[0].total} reportes activos asociados. Primero debe resolver o reasignar los reportes.`;
      return res.redirect('/calles');
    }

    await db.query('UPDATE calles SET activo = 0 WHERE id = ?', [id]);

    await registrarAuditoria(
      req.session.usuario,
      'DESACTIVAR',
      'calles',
      id,
      calleADesactivar[0],
      { motivo: motivo || 'Desactivado por administrador', activo: false }
    );

    req.session.mensaje = `Calle "${calleADesactivar[0].nombre}" desactivada correctamente`;
    res.redirect('/calles');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al desactivar calle';
    res.redirect('/calles');
  }
};

// ==========================
// 📌 ACTIVAR CALLE (REACTIVAR)
// ==========================
exports.activar = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const [calleAActivar] = await db.query(
      'SELECT nombre FROM calles WHERE id = ? AND activo = 0',
      [id]
    );

    if (calleAActivar.length === 0) {
      req.session.error = 'Calle no encontrada o ya está activa';
      return res.redirect('/calles/inactivos');
    }

    await db.query('UPDATE calles SET activo = 1 WHERE id = ?', [id]);

    await registrarAuditoria(
      req.session.usuario,
      'ACTIVAR',
      'calles',
      id,
      { activo: false },
      { motivo: motivo || 'Reactivado por administrador', activo: true }
    );

    req.session.mensaje = `Calle "${calleAActivar[0].nombre}" activada correctamente`;
    res.redirect('/calles/inactivos');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al activar calle';
    res.redirect('/calles/inactivos');
  }
};

// ==========================
// 📌 ELIMINAR FÍSICAMENTE (SOLO SUPERADMIN CON MOTIVO)
// ==========================
exports.destruir = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    if (!req.session.usuario || req.session.usuario.rol_id !== 5) {
      req.session.error = 'No autorizado';
      return res.redirect('/calles/inactivos');
    }

    if (!motivo || motivo.trim() === '') {
      req.session.error = 'Debe especificar un motivo para eliminar permanentemente la calle';
      return res.redirect('/calles/inactivos');
    }

    const [calleAEliminar] = await db.query(
      'SELECT nombre, id FROM calles WHERE id = ?',
      [id]
    );

    if (calleAEliminar.length === 0) {
      req.session.error = 'Calle no encontrada';
      return res.redirect('/calles/inactivos');
    }

    // Verificar si tiene reportes asociados (incluso inactivos)
    const [reportesAsociados] = await db.query(
      'SELECT COUNT(*) as total FROM reportes WHERE calle_id = ?',
      [id]
    );

    if (reportesAsociados[0].total > 0) {
      req.session.error = `No se puede eliminar la calle porque tiene ${reportesAsociados[0].total} reportes asociados. Primero debe eliminar o reasignar los reportes.`;
      return res.redirect('/calles/inactivos');
    }

    const datosCalle = calleAEliminar[0];
    const datosConMotivo = {
      ...datosCalle,
      motivo_eliminacion: motivo.trim(),
      eliminado_por: req.session.usuario.nombre,
      fecha_eliminacion: new Date().toLocaleString()
    };

    await db.query('DELETE FROM calles WHERE id = ?', [id]);

    await registrarAuditoria(
      req.session.usuario,
      'ELIMINAR_PERMANENTEMENTE',
      'calles',
      id,
      datosConMotivo,
      { motivo: motivo.trim(), eliminado_por: req.session.usuario.nombre },
      req
    );

    req.session.mensaje = `Calle "${datosCalle.nombre}" eliminada permanentemente. Motivo: ${motivo}`;
    res.redirect('/calles/inactivos');
  } catch (err) {
    console.error('Error en destruir:', err);
    req.session.error = 'Error al eliminar calle permanentemente';
    res.redirect('/calles/inactivos');
  }
};