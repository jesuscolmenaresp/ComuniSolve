const db = require('../models/db');
const bcrypt = require('bcryptjs');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');

// ==========================
// 📌 LISTAR USUARIOS ACTIVOS
// ==========================
exports.listar = async (req, res) => {
  try {
    const [usuarios] = await db.query(`
      SELECT u.*, r.nombre as rol_nombre
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.activo = 1
      ORDER BY 
        CASE u.estado
          WHEN 'pendiente' THEN 1
          WHEN 'aprobado' THEN 2
          WHEN 'rechazado' THEN 3
        END,
        CASE 
          WHEN u.rol_id = 1 THEN 1
          WHEN u.rol_id = 2 THEN 2
          WHEN u.rol_id = 3 THEN 3
          ELSE 4
        END,
        u.nombre ASC
    `);

    // Para cada usuario, obtener sus calles y comunidades
    for (let usuario of usuarios) {
      if (usuario.rol_id === 2) {
        const [calles] = await db.query(`
          SELECT nombre 
          FROM calles 
          WHERE lider_id = ? AND activo = 1
          ORDER BY nombre
        `, [usuario.id]);
        usuario.calles_lideradas = calles.map(c => c.nombre);
      } 
      else if (usuario.rol_id === 3) {
        const [calle] = await db.query(`
          SELECT nombre 
          FROM calles 
          WHERE id = ? AND activo = 1
        `, [usuario.calle_id]);
        usuario.calle_nombre = calle[0]?.nombre;
      }
      else if (usuario.rol_id === 4) {
        const [calle] = await db.query(`
          SELECT nombre 
          FROM calles 
          WHERE id = ? AND activo = 1
        `, [usuario.calle_id]);
        usuario.calle_nombre = calle[0]?.nombre;
      }
      else if (usuario.rol_id === 1) {
        const [comunidades] = await db.query(`
          SELECT c.nombre 
          FROM comunidades c
          INNER JOIN ubch_comunidades uc ON c.id = uc.comunidad_id
          WHERE uc.ubch_id = ? AND c.activo = 1
          ORDER BY c.nombre
        `, [usuario.id]);
        usuario.comunidades_atiende = comunidades.map(c => c.nombre);
      }
    }

    res.render('usuarios/listar', { 
      usuarios,
      usuario: req.session.usuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al listar usuarios');
  }
};

// ==========================
// 📌 LISTAR USUARIOS INACTIVOS (UBCH y SuperAdmin)
// ==========================
exports.listarInactivos = async (req, res) => {
  try {
    // Verificar que sea UBCH o SuperAdmin
    if (!req.session.usuario || (req.session.usuario.rol_id !== 1 && req.session.usuario.rol_id !== 5)) {
      req.session.error = 'No autorizado';
      return res.redirect('/dashboard');
    }

    let query = `
      SELECT u.*, r.nombre as rol_nombre
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      WHERE u.activo = 0
    `;
    
    // Si es UBCH (rol 1), no mostrar SuperAdmins inactivos
    if (req.session.usuario.rol_id === 1) {
      query += " AND u.rol_id != 5";
    }
    
    query += " ORDER BY u.id DESC";
    
    const [usuarios] = await db.query(query);

    res.render('usuarios/inactivos', { 
      usuarios,
      usuario: req.session.usuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al listar usuarios inactivos';
    res.redirect('/dashboard');
  }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE NUEVO USUARIO
// ==========================
exports.formCrear = async (req, res) => {
  try {
    const [roles] = await db.query('SELECT * FROM roles');
    
    const [calles] = await db.query(`
      SELECT c.*, 
             CONCAT(c.nombre, ' (Jefe: ', u.nombre, ')') as nombre_completo
      FROM calles c
      LEFT JOIN usuarios u ON c.jefe_id = u.id
      WHERE c.activo = 1
      ORDER BY c.nombre
    `);
    
    const [comunidades] = await db.query('SELECT * FROM comunidades WHERE activo = 1 ORDER BY nombre');

    res.render('usuarios/crear', { 
      roles, 
      calles,
      comunidades,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar formulario');
  }
};

// ==========================
// 📌 GUARDAR NUEVO USUARIO
// ==========================
exports.crear = async (req, res) => {
  const { cedula, nombre, email, password, telefono, rol_id, calle_id, calles_lider, comunidades } = req.body;

  try {
    // ========== VALIDACIÓN DE PERMISOS PARA CREAR SUPERADMIN ==========
    // Solo SuperAdmin puede crear otro SuperAdmin
    if (rol_id == 5 && req.session.usuario.rol_id !== 5) {
      req.session.error = 'No tiene permisos para crear un SuperAdministrador';
      return res.redirect('/usuarios/nuevo');
    }

    // Verificar si el email ya existe
    const [existente] = await db.query('SELECT id FROM usuarios WHERE email = ? AND activo = 1', [email]);
    if (existente.length > 0) {
      req.session.error = 'El email ya está registrado';
      return res.redirect('/usuarios/nuevo');
    }

    // Verificar si la cédula ya existe
    if (cedula && cedula.trim() !== '') {
      const [cedulaExistente] = await db.query('SELECT id FROM usuarios WHERE cedula = ? AND activo = 1', [cedula]);
      if (cedulaExistente.length > 0) {
        req.session.error = 'La cédula ya está registrada';
        return res.redirect('/usuarios/nuevo');
      }
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Iniciar transacción
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      let calleAsignada = null;
      if (rol_id == 3 || rol_id == 4) {
        calleAsignada = calle_id || null;
      }

      const [result] = await connection.query(
        `INSERT INTO usuarios (cedula, nombre, email, password, telefono, rol_id, calle_id, activo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [cedula || null, nombre, email, passwordHash, telefono || null, rol_id, calleAsignada]
      );

      const nuevoUsuarioId = result.insertId;

      // Si es líder y seleccionó calles, asignarlas
      if (rol_id == 2 && calles_lider && calles_lider.length > 0) {
        const callesArray = Array.isArray(calles_lider) ? calles_lider : [calles_lider];
        for (const calleId of callesArray) {
          await connection.query(
            'UPDATE calles SET lider_id = ? WHERE id = ?',
            [nuevoUsuarioId, calleId]
          );
        }
      }

      // Si es UBCH y seleccionó comunidades, asignarlas
      if (rol_id == 1 && comunidades && comunidades.length > 0) {
        const comunidadesArray = Array.isArray(comunidades) ? comunidades : [comunidades];
        for (const comunidadId of comunidadesArray) {
          await connection.query(
            'INSERT INTO ubch_comunidades (ubch_id, comunidad_id) VALUES (?, ?)',
            [nuevoUsuarioId, comunidadId]
          );
        }
      }

      await connection.commit();

      await registrarAuditoria(
        req.session.usuario,
        'CREAR',
        'usuarios',
        nuevoUsuarioId,
        null,
        { cedula, nombre, email, rol_id, calle_id: calleAsignada }
      );

      req.session.mensaje = 'Usuario creado exitosamente';
      res.redirect('/usuarios');
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error(err);
    req.session.error = 'Error al crear usuario';
    res.redirect('/usuarios/nuevo');
  }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE EDICIÓN
// ==========================
exports.formEditar = async (req, res) => {
  const { id } = req.params;

  try {
    const [usuario] = await db.query('SELECT * FROM usuarios WHERE id = ? AND activo = 1', [id]);
    if (usuario.length === 0) {
      return res.status(404).send('Usuario no encontrado');
    }

    let callesLideradas = [];
    if (usuario[0].rol_id === 2) {
      const [calles] = await db.query('SELECT id FROM calles WHERE lider_id = ? AND activo = 1', [id]);
      callesLideradas = calles.map(c => c.id);
    }

    let comunidadesAsignadas = [];
    if (usuario[0].rol_id === 1) {
      const [comunidades] = await db.query(
        `SELECT comunidad_id FROM ubch_comunidades 
         WHERE ubch_id = ? AND comunidad_id IN (SELECT id FROM comunidades WHERE activo = 1)`,
        [id]
      );
      comunidadesAsignadas = comunidades.map(c => c.comunidad_id);
    }

    const [roles] = await db.query('SELECT * FROM roles');
    const [calles] = await db.query(`
      SELECT c.*, 
             CONCAT(c.nombre, ' (Jefe: ', u.nombre, ')') as nombre_completo
      FROM calles c
      LEFT JOIN usuarios u ON c.jefe_id = u.id
      WHERE c.activo = 1
      ORDER BY c.nombre
    `);
    
    const [comunidades] = await db.query('SELECT * FROM comunidades WHERE activo = 1 ORDER BY nombre');

    res.render('usuarios/editar', { 
      usuario: usuario[0],
      roles, 
      calles,
      comunidades,
      callesLideradas,
      comunidadesAsignadas,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar formulario');
  }
};

// ==========================
// 📌 ACTUALIZAR USUARIO
// ==========================
exports.actualizar = async (req, res) => {
  const { id } = req.params;
  const { 
    cedula, nombre, email, telefono, rol_id, 
    password, 
    calle_jefe_id, calle_ciudadano_id, 
    calles_lider, 
    comunidades 
  } = req.body;

  try {
    // ========== VALIDACIONES DE PERMISOS PARA EDITAR ==========
    
    // Obtener el usuario actual para verificar su rol
    const [usuarioActual] = await db.query('SELECT rol_id FROM usuarios WHERE id = ?', [id]);
    
    if (usuarioActual.length === 0) {
      req.session.error = 'Usuario no encontrado';
      return res.redirect('/usuarios');
    }
    
    const rolActual = usuarioActual[0].rol_id;
    
    // 1. Si el usuario actual es SuperAdmin y quien edita NO es SuperAdmin -> NO PERMITIR
    if (rolActual === 5 && req.session.usuario.rol_id !== 5) {
      req.session.error = 'No tiene permisos para editar un SuperAdministrador';
      return res.redirect('/usuarios');
    }
    
    // 2. Si intentan cambiar el rol a SuperAdmin pero quien edita NO es SuperAdmin -> NO PERMITIR
    if (rol_id == 5 && req.session.usuario.rol_id !== 5) {
      req.session.error = 'No tiene permisos para asignar el rol de SuperAdministrador';
      return res.redirect(`/usuarios/${id}/editar`);
    }
    
    // 3. Si quien edita es UBCH (rol 1) y el usuario a editar es UBCH (rol 1) -> NO PERMITIR
    // (Un UBCH no puede editar a otro UBCH, solo SuperAdmin puede)
    if (req.session.usuario.rol_id === 1 && rolActual === 1) {
      req.session.error = 'No tiene permisos para editar otro usuario UBCH';
      return res.redirect('/usuarios');
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const [usuarioAnterior] = await connection.query(
        'SELECT nombre, email, telefono, rol_id, calle_id, cedula FROM usuarios WHERE id = ? AND activo = 1',
        [id]
      );

      if (usuarioAnterior.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      let updates = [];
      let params = [];

      updates.push('cedula = ?');
      params.push(cedula || null);
      
      updates.push('nombre = ?');
      params.push(nombre);
      
      updates.push('email = ?');
      params.push(email);
      
      updates.push('telefono = ?');
      params.push(telefono || null);
      
      updates.push('rol_id = ?');
      params.push(rol_id);

      let nuevaCalleId = null;
      
      if (rol_id == 3) {
        nuevaCalleId = calle_jefe_id || null;
        updates.push('calle_id = ?');
        params.push(nuevaCalleId);
      } else if (rol_id == 4) {
        nuevaCalleId = calle_ciudadano_id || null;
        updates.push('calle_id = ?');
        params.push(nuevaCalleId);
      } else {
        updates.push('calle_id = NULL');
      }

      if (password && password.trim() !== '') {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        updates.push('password = ?');
        params.push(passwordHash);
      }

      params.push(id);

      const query = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`;
      
      await connection.query(query, params);

      // Si es líder, actualizar sus calles
      if (rol_id == 2) {
        await connection.query('UPDATE calles SET lider_id = NULL WHERE lider_id = ?', [id]);
        
        if (calles_lider && calles_lider.length > 0) {
          const callesArray = Array.isArray(calles_lider) ? calles_lider : [calles_lider];
          for (const calleId of callesArray) {
            await connection.query(
              'UPDATE calles SET lider_id = ? WHERE id = ?',
              [id, calleId]
            );
          }
        }
      } else {
        await connection.query('UPDATE calles SET lider_id = NULL WHERE lider_id = ?', [id]);
      }

      // Si es UBCH, actualizar sus comunidades
      if (rol_id == 1) {
        await connection.query('DELETE FROM ubch_comunidades WHERE ubch_id = ?', [id]);
        
        if (comunidades && comunidades.length > 0) {
          const comunidadesArray = Array.isArray(comunidades) ? comunidades : [comunidades];
          for (const comunidadId of comunidadesArray) {
            await connection.query(
              'INSERT INTO ubch_comunidades (ubch_id, comunidad_id) VALUES (?, ?)',
              [id, comunidadId]
            );
          }
        }
      }

      await connection.commit();

      const datosNuevos = { 
        cedula, nombre, email, telefono, rol_id, 
        calle_id: nuevaCalleId,
        calles_lider: calles_lider || [],
        comunidades: comunidades || []
      };
      
      await registrarAuditoria(
        req.session.usuario,
        'EDITAR',
        'usuarios',
        id,
        usuarioAnterior[0],
        datosNuevos
      );

      req.session.mensaje = 'Usuario actualizado exitosamente';
      res.redirect('/usuarios');

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error(err);
    req.session.error = 'Error al actualizar usuario';
    res.redirect(`/usuarios/${id}/editar`);
  }
};
// ==========================
// 📌 DESACTIVAR USUARIO (SOFT DELETE)
// ==========================
exports.eliminar = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    // No permitir desactivarse a sí mismo
    if (parseInt(id) === req.session.usuario.id) {
      req.session.error = 'No puedes desactivarte a ti mismo';
      return res.redirect('/usuarios');
    }

    const [usuarioADesactivar] = await db.query(
      'SELECT nombre, email, rol_id FROM usuarios WHERE id = ? AND activo = 1',
      [id]
    );

    if (usuarioADesactivar.length === 0) {
      req.session.error = 'Usuario no encontrado o ya está inactivo';
      return res.redirect('/usuarios');
    }

    // Desactivar usuario (soft delete)
    await db.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [id]);

    await registrarAuditoria(
      req.session.usuario,
      'DESACTIVAR',
      'usuarios',
      id,
      usuarioADesactivar[0],
      { motivo: motivo || 'Desactivado por administrador', activo: false }
    );

    req.session.mensaje = `Usuario "${usuarioADesactivar[0].nombre}" desactivado correctamente`;
    res.redirect('/usuarios');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al desactivar usuario';
    res.redirect('/usuarios');
  }
};

// ==========================
// 📌 ACTIVAR USUARIO (REACTIVAR)
// ==========================
exports.activar = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const [usuarioAActivar] = await db.query(
      'SELECT nombre, email, rol_id FROM usuarios WHERE id = ? AND activo = 0',
      [id]
    );

    if (usuarioAActivar.length === 0) {
      req.session.error = 'Usuario no encontrado o ya está activo';
      return res.redirect('/usuarios/inactivos');
    }

    // Activar usuario
    await db.query('UPDATE usuarios SET activo = 1 WHERE id = ?', [id]);

    await registrarAuditoria(
      req.session.usuario,
      'ACTIVAR',
      'usuarios',
      id,
      { activo: false },
      { motivo: motivo || 'Reactivado por administrador', activo: true }
    );

    req.session.mensaje = `Usuario "${usuarioAActivar[0].nombre}" activado correctamente`;
    res.redirect('/usuarios/inactivos');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al activar usuario';
    res.redirect('/usuarios/inactivos');
  }
};

// ==========================
// 📌 ELIMINAR FÍSICAMENTE (SOLO SUPERADMIN CON MOTIVO)
// ==========================
exports.destruir = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  console.log('=== DESTRUIR USUARIO ===');
  console.log('ID:', id);
  console.log('Motivo recibido:', motivo);

  try {
    // Verificar que sea SuperAdmin
    if (!req.session.usuario || req.session.usuario.rol_id !== 5) {
      req.session.error = 'No autorizado';
      return res.redirect('/usuarios/inactivos');
    }

    // Validar que se ingrese un motivo
    if (!motivo || motivo.trim() === '') {
      req.session.error = 'Debe especificar un motivo para eliminar permanentemente al usuario';
      return res.redirect('/usuarios/inactivos');
    }

    // No permitir eliminarse a sí mismo
    if (parseInt(id) === req.session.usuario.id) {
      req.session.error = 'No puedes eliminarte a ti mismo';
      return res.redirect('/usuarios/inactivos');
    }

    const [usuarioAEliminar] = await db.query(
      'SELECT nombre, email, cedula, rol_id FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarioAEliminar.length === 0) {
      req.session.error = 'Usuario no encontrado';
      return res.redirect('/usuarios/inactivos');
    }

    // Guardar datos para auditoría antes de eliminar
    const datosUsuario = usuarioAEliminar[0];
    
    // Crear un objeto con los datos del usuario y el motivo
    const datosParaAuditoria = {
      id: datosUsuario.id,
      nombre: datosUsuario.nombre,
      email: datosUsuario.email,
      cedula: datosUsuario.cedula || 'No registrada',
      rol_id: datosUsuario.rol_id,
      motivo_eliminacion: motivo.trim(),
      eliminado_por: req.session.usuario.nombre,
      eliminado_por_id: req.session.usuario.id,
      fecha_eliminacion: new Date().toLocaleString()
    };

    console.log('Datos a guardar en auditoría:', datosParaAuditoria);

    // Eliminación física permanente
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);

    // Registrar en auditoría con el motivo (PASANDO req PARA IP Y USER-AGENT)
    await registrarAuditoria(
      req.session.usuario,
      'ELIMINAR_PERMANENTEMENTE',
      'usuarios',
      id,
      datosParaAuditoria,  // Datos anteriores (lo que se eliminó con el motivo)
      { 
        motivo: motivo.trim(), 
        eliminado_por: req.session.usuario.nombre,
        accion: 'Eliminación permanente'
      },
      req  // 👈 IMPORTANTE: pasar req para IP y User-Agent
    );

    req.session.mensaje = `Usuario "${datosUsuario.nombre}" eliminado permanentemente. Motivo: ${motivo}`;
    res.redirect('/usuarios/inactivos');
  } catch (err) {
    console.error('Error en destruir:', err);
    req.session.error = 'Error al eliminar usuario permanentemente: ' + err.message;
    res.redirect('/usuarios/inactivos');
  }
};

// ==========================
// 📌 APROBAR CIUDADANO (con auditoría)
// ==========================
exports.aprobar = async (req, res) => {
  const { id } = req.params;
  const adminId = req.session.usuario.id;

  try {
    const [usuario] = await db.query('SELECT email, nombre, estado FROM usuarios WHERE id = ? AND activo = 1', [id]);
    
    if (usuario.length === 0) {
      req.session.error = 'Usuario no encontrado';
      return res.redirect('/usuarios');
    }

    const estadoAnterior = usuario[0].estado;

    await db.query(
      `UPDATE usuarios 
       SET estado = 'aprobado', fecha_aprobacion = NOW(), aprobado_por = ? 
       WHERE id = ?`,
      [adminId, id]
    );

    // Registrar en auditoría
    await registrarAuditoria(
      req.session.usuario,
      'EDITAR',
      'usuarios',
      id,
      { estado: estadoAnterior },
      { estado: 'aprobado', aprobado_por: adminId },
      req
    );

    const { enviarNotificacionEstadoUsuario } = require('../services/emailService');
    await enviarNotificacionEstadoUsuario(usuario[0], 'aprobado');

    req.session.mensaje = 'Usuario aprobado exitosamente';
    res.redirect('/usuarios');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al aprobar usuario';
    res.redirect('/usuarios');
  }
};

// ==========================
// 📌 RECHAZAR CIUDADANO (con auditoría)
// ==========================
exports.rechazar = async (req, res) => {
  const { id } = req.params;
  const adminId = req.session.usuario.id;
  const { motivo } = req.body;

  try {
    const [usuario] = await db.query('SELECT email, nombre, estado FROM usuarios WHERE id = ? AND activo = 1', [id]);
    
    if (usuario.length === 0) {
      req.session.error = 'Usuario no encontrado';
      return res.redirect('/usuarios');
    }

    const estadoAnterior = usuario[0].estado;

    await db.query(
      `UPDATE usuarios 
       SET estado = 'rechazado', fecha_aprobacion = NOW(), aprobado_por = ? 
       WHERE id = ?`,
      [adminId, id]
    );

    // Registrar en auditoría
    await registrarAuditoria(
      req.session.usuario,
      'EDITAR',
      'usuarios',
      id,
      { estado: estadoAnterior },
      { estado: 'rechazado', motivo: motivo || 'No especificado', aprobado_por: adminId },
      req
    );

    const { enviarNotificacionEstadoUsuario } = require('../services/emailService');
    await enviarNotificacionEstadoUsuario(usuario[0], 'rechazado', motivo);

    req.session.mensaje = 'Usuario rechazado';
    res.redirect('/usuarios');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al rechazar usuario';
    res.redirect('/usuarios');
  }
};
// ==========================
// 📌 REAPROBAR USUARIO (cambiar de rechazado a aprobado)
// ==========================
exports.reaprobar = async (req, res) => {
  const { id } = req.params;
  const adminId = req.session.usuario.id;

  try {
    const [usuario] = await db.query('SELECT email, nombre, estado FROM usuarios WHERE id = ? AND activo = 1', [id]);
    
    if (usuario.length === 0) {
      req.session.error = 'Usuario no encontrado';
      return res.redirect('/usuarios');
    }

    if (usuario[0].estado !== 'rechazado') {
      req.session.error = 'Este usuario no está rechazado';
      return res.redirect('/usuarios');
    }

    const estadoAnterior = usuario[0].estado;

    await db.query(
      `UPDATE usuarios 
       SET estado = 'aprobado', fecha_aprobacion = NOW(), aprobado_por = ? 
       WHERE id = ?`,
      [adminId, id]
    );

    // Registrar en auditoría
    await registrarAuditoria(
      req.session.usuario,
      'REAPROBAR',
      'usuarios',
      id,
      { estado: estadoAnterior },
      { estado: 'aprobado', reaprobado_por: adminId, motivo: 'Reaprobado por administrador' },
      req
    );

    const { enviarNotificacionEstadoUsuario } = require('../services/emailService');
    await enviarNotificacionEstadoUsuario(usuario[0], 'aprobado', null, true);

    req.session.mensaje = `Usuario "${usuario[0].nombre}" ha sido reaprobado exitosamente`;
    res.redirect('/usuarios');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al reaprobar usuario';
    res.redirect('/usuarios');
  }
};