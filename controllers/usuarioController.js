const db = require('../models/db');
const bcrypt = require('bcryptjs');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');

// 📌 Listar todos los usuarios
exports.listar = async (req, res) => {
  try {
    const [usuarios] = await db.query(`
      SELECT u.*, r.nombre as rol_nombre
      FROM usuarios u
      INNER JOIN roles r ON u.rol_id = r.id
      ORDER BY 
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
        // Líder: obtener todas las calles que lidera
        const [calles] = await db.query(`
          SELECT nombre 
          FROM calles 
          WHERE lider_id = ?
          ORDER BY nombre
        `, [usuario.id]);
        usuario.calles_lideradas = calles.map(c => c.nombre);
      } 
      else if (usuario.rol_id === 3) {
        // Jefe: obtener su calle asignada
        const [calle] = await db.query(`
          SELECT nombre 
          FROM calles 
          WHERE id = ?
        `, [usuario.calle_id]);
        usuario.calle_nombre = calle[0]?.nombre;
      }
      else if (usuario.rol_id === 4) {
        // Ciudadano: obtener su calle asignada
        const [calle] = await db.query(`
          SELECT nombre 
          FROM calles 
          WHERE id = ?
        `, [usuario.calle_id]);
        usuario.calle_nombre = calle[0]?.nombre;
      }
      else if (usuario.rol_id === 1) {
        // UBCH: obtener las comunidades que atiende
        const [comunidades] = await db.query(`
          SELECT c.nombre 
          FROM comunidades c
          INNER JOIN ubch_comunidades uc ON c.id = uc.comunidad_id
          WHERE uc.ubch_id = ?
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

// 📌 Mostrar formulario de nuevo usuario
exports.formCrear = async (req, res) => {
  try {
    const [roles] = await db.query('SELECT * FROM roles');
    
    const [calles] = await db.query(`
      SELECT c.*, 
             CONCAT(c.nombre, ' (Jefe: ', u.nombre, ')') as nombre_completo
      FROM calles c
      LEFT JOIN usuarios u ON c.jefe_id = u.id
      ORDER BY c.nombre
    `);
    
    const [comunidades] = await db.query('SELECT * FROM comunidades ORDER BY nombre');

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

// 📌 Guardar nuevo usuario
exports.crear = async (req, res) => {
  const { nombre, email, password, telefono, rol_id, calle_id, calles_lider, comunidades } = req.body;

  try {
    // Verificar si el email ya existe
    const [existente] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existente.length > 0) {
      req.session.error = 'El email ya está registrado';
      return res.redirect('/usuarios/nuevo');
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Iniciar transacción
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Insertar usuario - GUARDAR calle_id para jefes y ciudadanos
      let calleAsignada = null;
      if (rol_id == 3 || rol_id == 4) {
        calleAsignada = calle_id || null;
      }

      const [result] = await connection.query(
        `INSERT INTO usuarios (nombre, email, password, telefono, rol_id, calle_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre, email, passwordHash, telefono || null, rol_id, calleAsignada]
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

      // Registrar en auditoría
      await registrarAuditoria(
        req.session.usuario,
        'CREAR',
        'usuarios',
        nuevoUsuarioId,
        null,
        { nombre, email, rol_id, calle_id: calleAsignada }
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

// 📌 Mostrar formulario de edición
exports.formEditar = async (req, res) => {
  const { id } = req.params;

  try {
    const [usuario] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (usuario.length === 0) {
      return res.status(404).send('Usuario no encontrado');
    }

    // Si es líder, obtener las calles que lidera
    let callesLideradas = [];
    if (usuario[0].rol_id === 2) {
      const [calles] = await db.query('SELECT id FROM calles WHERE lider_id = ?', [id]);
      callesLideradas = calles.map(c => c.id);
    }

    // Si es UBCH, obtener las comunidades asignadas
    let comunidadesAsignadas = [];
    if (usuario[0].rol_id === 1) {
      const [comunidades] = await db.query(
        'SELECT comunidad_id FROM ubch_comunidades WHERE ubch_id = ?',
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
      ORDER BY c.nombre
    `);
    
    const [comunidades] = await db.query('SELECT * FROM comunidades ORDER BY nombre');

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

// 📌 Actualizar usuario
exports.actualizar = async (req, res) => {
  const { id } = req.params;
  const { 
    nombre, email, telefono, rol_id, 
    password, 
    calle_jefe_id,      // Para jefes
    calle_ciudadano_id, // Para ciudadanos
    calles_lider, 
    comunidades 
  } = req.body;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Obtener datos anteriores antes de actualizar
      const [usuarioAnterior] = await connection.query(
        'SELECT nombre, email, telefono, rol_id, calle_id FROM usuarios WHERE id = ?',
        [id]
      );

      let updates = [];
      let params = [];

      updates.push('nombre = ?');
      params.push(nombre);
      
      updates.push('email = ?');
      params.push(email);
      
      updates.push('telefono = ?');
      params.push(telefono || null);
      
      updates.push('rol_id = ?');
      params.push(rol_id);

      let nuevaCalleId = null;
      
      // Determinar qué calle_id usar según el rol
      if (rol_id == 3) {
        // Jefe
        nuevaCalleId = calle_jefe_id || null;
        updates.push('calle_id = ?');
        params.push(nuevaCalleId);
      } else if (rol_id == 4) {
        // Ciudadano
        nuevaCalleId = calle_ciudadano_id || null;
        updates.push('calle_id = ?');
        params.push(nuevaCalleId);
      } else {
        updates.push('calle_id = NULL');
      }

      // Si hay nueva contraseña
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

      // Registrar en auditoría
      const datosNuevos = { 
        nombre, email, telefono, rol_id, 
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

// 📌 Eliminar usuario
exports.eliminar = async (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que no sea el mismo usuario logueado
    if (parseInt(id) === req.session.usuario.id) {
      req.session.error = 'No puedes eliminarte a ti mismo';
      return res.redirect('/usuarios');
    }

    // Obtener datos del usuario antes de eliminar
    const [usuarioAEliminar] = await db.query(
      'SELECT nombre, email, rol_id FROM usuarios WHERE id = ?',
      [id]
    );

    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);

    // Registrar en auditoría
    await registrarAuditoria(
      req.session.usuario,
      'ELIMINAR',
      'usuarios',
      id,
      usuarioAEliminar[0],
      null
    );

    req.session.mensaje = 'Usuario eliminado exitosamente';
    res.redirect('/usuarios');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al eliminar usuario';
    res.redirect('/usuarios');
  }
};