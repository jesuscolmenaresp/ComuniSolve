const db = require('../models/db');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');

// ==========================
// 📌 LISTAR COMUNIDADES ACTIVAS
// ==========================
exports.listar = async (req, res) => {
  try {
    const [comunidades] = await db.query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM calles WHERE comunidad_id = c.id AND activo = 1) as total_calles
      FROM comunidades c
      WHERE c.activo = 1
      ORDER BY c.nombre
    `);
    
    res.render('comunidades/listar', { 
      comunidades,
      usuario: req.session.usuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al listar comunidades');
  }
};

// ==========================
// 📌 LISTAR COMUNIDADES INACTIVAS
// ==========================
exports.listarInactivas = async (req, res) => {
  try {
    if (!req.session.usuario || (req.session.usuario.rol_id !== 1 && req.session.usuario.rol_id !== 5)) {
      req.session.error = 'No autorizado';
      return res.redirect('/dashboard');
    }

    const [comunidades] = await db.query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM calles WHERE comunidad_id = c.id) as total_calles
      FROM comunidades c
      WHERE c.activo = 0
      ORDER BY c.nombre
    `);
    
    res.render('comunidades/inactivos', { 
      comunidades,
      usuario: req.session.usuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al listar comunidades inactivas';
    res.redirect('/comunidades');
  }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE NUEVA COMUNIDAD
// ==========================
exports.formCrear = (req, res) => {
  res.render('comunidades/crear', { 
    usuario: req.session.usuario,
    session: req.session
  });
};

// ==========================
// 📌 GUARDAR NUEVA COMUNIDAD
// ==========================
exports.crear = async (req, res) => {
  const { nombre, descripcion } = req.body;
  
  try {
    const [result] = await db.query(
      'INSERT INTO comunidades (nombre, descripcion, activo) VALUES (?, ?, 1)',
      [nombre, descripcion || null]
    );
    
    await registrarAuditoria(
      req.session.usuario,
      'CREAR',
      'comunidades',
      result.insertId,
      null,
      { nombre, descripcion }
    );
    
    req.session.mensaje = 'Comunidad creada exitosamente';
    res.redirect('/comunidades');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al crear comunidad';
    res.redirect('/comunidades/nueva');
  }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE EDICIÓN
// ==========================
exports.formEditar = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [comunidad] = await db.query('SELECT * FROM comunidades WHERE id = ? AND activo = 1', [id]);
    if (comunidad.length === 0) {
      return res.status(404).send('Comunidad no encontrada');
    }
    
    res.render('comunidades/editar', { 
      comunidad: comunidad[0],
      usuario: req.session.usuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar formulario');
  }
};

// ==========================
// 📌 ACTUALIZAR COMUNIDAD
// ==========================
exports.actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  
  try {
    const [comunidadAnterior] = await db.query('SELECT * FROM comunidades WHERE id = ?', [id]);
    
    await db.query(
      'UPDATE comunidades SET nombre = ?, descripcion = ? WHERE id = ?',
      [nombre, descripcion || null, id]
    );
    
    await registrarAuditoria(
      req.session.usuario,
      'EDITAR',
      'comunidades',
      id,
      comunidadAnterior[0],
      { nombre, descripcion }
    );
    
    req.session.mensaje = 'Comunidad actualizada exitosamente';
    res.redirect('/comunidades');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al actualizar comunidad';
    res.redirect(`/comunidades/${id}/editar`);
  }
};

// ==========================
// 📌 DESACTIVAR COMUNIDAD (SOFT DELETE)
// ==========================
exports.desactivar = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const [comunidadADesactivar] = await db.query(
      'SELECT nombre FROM comunidades WHERE id = ? AND activo = 1',
      [id]
    );

    if (comunidadADesactivar.length === 0) {
      req.session.error = 'Comunidad no encontrada o ya está inactiva';
      return res.redirect('/comunidades');
    }

    // Verificar si tiene calles activas asociadas
    const [callesAsociadas] = await db.query(
      'SELECT COUNT(*) as total FROM calles WHERE comunidad_id = ? AND activo = 1',
      [id]
    );

    if (callesAsociadas[0].total > 0) {
      req.session.error = `No se puede desactivar la comunidad porque tiene ${callesAsociadas[0].total} calles activas asociadas. Primero debe desactivar o reasignar las calles.`;
      return res.redirect('/comunidades');
    }

    await db.query('UPDATE comunidades SET activo = 0 WHERE id = ?', [id]);

    await registrarAuditoria(
      req.session.usuario,
      'DESACTIVAR',
      'comunidades',
      id,
      comunidadADesactivar[0],
      { motivo: motivo || 'Desactivado por administrador', activo: false }
    );

    req.session.mensaje = `Comunidad "${comunidadADesactivar[0].nombre}" desactivada correctamente`;
    res.redirect('/comunidades');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al desactivar comunidad';
    res.redirect('/comunidades');
  }
};

// ==========================
// 📌 ACTIVAR COMUNIDAD (REACTIVAR)
// ==========================
exports.activar = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const [comunidadAActivar] = await db.query(
      'SELECT nombre FROM comunidades WHERE id = ? AND activo = 0',
      [id]
    );

    if (comunidadAActivar.length === 0) {
      req.session.error = 'Comunidad no encontrada o ya está activa';
      return res.redirect('/comunidades/inactivos');
    }

    await db.query('UPDATE comunidades SET activo = 1 WHERE id = ?', [id]);

    await registrarAuditoria(
      req.session.usuario,
      'ACTIVAR',
      'comunidades',
      id,
      { activo: false },
      { motivo: motivo || 'Reactivado por administrador', activo: true }
    );

    req.session.mensaje = `Comunidad "${comunidadAActivar[0].nombre}" activada correctamente`;
    res.redirect('/comunidades/inactivos');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al activar comunidad';
    res.redirect('/comunidades/inactivos');
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
      return res.redirect('/comunidades/inactivos');
    }

    if (!motivo || motivo.trim() === '') {
      req.session.error = 'Debe especificar un motivo para eliminar permanentemente la comunidad';
      return res.redirect('/comunidades/inactivos');
    }

    const [comunidadAEliminar] = await db.query(
      'SELECT nombre, id FROM comunidades WHERE id = ?',
      [id]
    );

    if (comunidadAEliminar.length === 0) {
      req.session.error = 'Comunidad no encontrada';
      return res.redirect('/comunidades/inactivos');
    }

    // Verificar si tiene calles asociadas (incluso inactivas)
    const [callesAsociadas] = await db.query(
      'SELECT COUNT(*) as total FROM calles WHERE comunidad_id = ?',
      [id]
    );

    if (callesAsociadas[0].total > 0) {
      req.session.error = `No se puede eliminar la comunidad porque tiene ${callesAsociadas[0].total} calles asociadas. Primero debe eliminar o reasignar las calles.`;
      return res.redirect('/comunidades/inactivos');
    }

    const datosComunidad = comunidadAEliminar[0];
    const datosConMotivo = {
      ...datosComunidad,
      motivo_eliminacion: motivo.trim(),
      eliminado_por: req.session.usuario.nombre,
      fecha_eliminacion: new Date().toLocaleString()
    };

    await db.query('DELETE FROM comunidades WHERE id = ?', [id]);

    await registrarAuditoria(
      req.session.usuario,
      'ELIMINAR_PERMANENTEMENTE',
      'comunidades',
      id,
      datosConMotivo,
      { motivo: motivo.trim(), eliminado_por: req.session.usuario.nombre },
      req
    );

    req.session.mensaje = `Comunidad "${datosComunidad.nombre}" eliminada permanentemente. Motivo: ${motivo}`;
    res.redirect('/comunidades/inactivos');
  } catch (err) {
    console.error('Error en destruir:', err);
    req.session.error = 'Error al eliminar comunidad permanentemente';
    res.redirect('/comunidades/inactivos');
  }
};

// ==========================
// 📌 ASIGNAR COMUNIDADES A UBCH
// ==========================
exports.asignarUBCH = async (req, res) => {
  const { ubch_id, comunidades } = req.body;
  
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();
    
    await connection.query('DELETE FROM ubch_comunidades WHERE ubch_id = ?', [ubch_id]);
    
    if (comunidades && comunidades.length > 0) {
      for (const comunidad_id of comunidades) {
        await connection.query(
          'INSERT INTO ubch_comunidades (ubch_id, comunidad_id) VALUES (?, ?)',
          [ubch_id, comunidad_id]
        );
      }
    }
    
    await connection.commit();
    connection.release();
    
    req.session.mensaje = 'Comunidades asignadas exitosamente';
    res.redirect('/usuarios');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al asignar comunidades';
    res.redirect('/usuarios');
  }
};

// ==========================
// 📌 OBTENER COMUNIDADES DE UN UBCH
// ==========================
exports.getComunidadesUBCH = async (req, res) => {
  const { ubch_id } = req.params;
  
  try {
    const [comunidades] = await db.query(
      'SELECT comunidad_id FROM ubch_comunidades WHERE ubch_id = ?',
      [ubch_id]
    );
    res.json(comunidades.map(c => c.comunidad_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener comunidades' });
  }
};