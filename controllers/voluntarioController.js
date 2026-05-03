const db = require('../models/db');
const { enviarNotificacionVoluntario, enviarNotificacionAsignacionVoluntario, enviarNotificacionNuevoVoluntario } = require('../services/emailService');

// ==========================
// 📌 LISTAR VOLUNTARIOS APROBADOS (PÚBLICO)
// ==========================
exports.listarVoluntariosPublicos = async (req, res) => {
  try {
    const [voluntarios] = await db.query(`
      SELECT nombre, telefono, habilidad FROM voluntarios WHERE estado = 'aprobado' ORDER BY nombre
    `);
    res.render('voluntarios/publico', { voluntarios, usuario: req.session?.usuario || null, session: req.session });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al listar voluntarios');
  }
};

// ==========================
// 📌 MI PERFIL DE VOLUNTARIO
// ==========================
exports.miPerfil = async (req, res) => {
  try {
    const [voluntario] = await db.query(`
      SELECT v.*, u.email FROM voluntarios v INNER JOIN usuarios u ON v.usuario_id = u.id WHERE v.usuario_id = ?
    `, [req.session.usuario.id]);
    
    const [asignaciones] = await db.query(`
      SELECT vr.*, r.titulo, r.descripcion, r.estado as reporte_estado, c.nombre as calle
      FROM voluntarios_reportes vr
      INNER JOIN reportes r ON vr.reporte_id = r.id
      INNER JOIN calles c ON r.calle_id = c.id
      WHERE vr.voluntario_id = ? AND vr.estado = 'pendiente'
      ORDER BY vr.fecha_asignacion DESC
    `, [voluntario[0]?.id]);
    
    const [asignacionesAceptadas] = await db.query(`
      SELECT vr.*, r.titulo, r.descripcion, r.estado as reporte_estado, c.nombre as calle
      FROM voluntarios_reportes vr
      INNER JOIN reportes r ON vr.reporte_id = r.id
      INNER JOIN calles c ON r.calle_id = c.id
      WHERE vr.voluntario_id = ? AND vr.estado = 'aceptado'
      ORDER BY vr.fecha_asignacion DESC
    `, [voluntario[0]?.id]);
    
    res.render('voluntarios/mi-perfil', { voluntario: voluntario[0] || null, asignaciones, asignacionesAceptadas, usuario: req.session.usuario, session: req.session });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar perfil');
  }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE POSTULACIÓN
// ==========================
exports.mostrarFormulario = async (req, res) => {
  try {
    const [existente] = await db.query('SELECT * FROM voluntarios WHERE usuario_id = ?', [req.session.usuario.id]);
    const esEdicion = req.path === '/editar';
    
    if (esEdicion && existente.length) {
      return res.render('voluntarios/registro', { usuario: req.session.usuario, yaSolicito: true, datosVoluntario: existente[0], session: req.session });
    }
    if (!esEdicion && existente.length) return res.redirect('/voluntarios/mi-perfil');
    
    res.render('voluntarios/registro', { usuario: req.session.usuario, yaSolicito: false, datosVoluntario: null, session: req.session });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar formulario');
  }
};

// ==========================
// 📌 GUARDAR/ACTUALIZAR POSTULACIÓN
// ==========================
exports.guardarVoluntario = async (req, res) => {
  const { nombre, telefono, habilidad, experiencia, disponibilidad_horaria } = req.body;
  const usuarioId = req.session.usuario.id;

  try {
    const [existente] = await db.query('SELECT id FROM voluntarios WHERE usuario_id = ?', [usuarioId]);
    
    if (existente.length) {
      await db.query(`UPDATE voluntarios SET nombre=?, telefono=?, habilidad=?, experiencia=?, disponibilidad_horaria=? WHERE usuario_id=?`,
        [nombre, telefono || null, habilidad, experiencia || null, disponibilidad_horaria || null, usuarioId]);
      req.session.mensaje = 'Perfil actualizado';
    } else {
      await db.query(`INSERT INTO voluntarios (nombre, telefono, habilidad, experiencia, disponibilidad_horaria, usuario_id, estado, fecha_solicitud) 
                      VALUES (?, ?, ?, ?, ?, ?, 'pendiente', NOW())`,
        [nombre, telefono || null, habilidad, experiencia || null, disponibilidad_horaria || null, usuarioId]);
      req.session.mensaje = 'Solicitud enviada';
      
      // Notificar a administradores en segundo plano
      setImmediate(async () => {
        try {
          const [admins] = await db.query('SELECT email, nombre FROM usuarios WHERE rol_id IN (1, 2)');
          for (const admin of admins) {
            if (admin.email) await enviarNotificacionNuevoVoluntario(admin, { nombre, habilidad, telefono, fecha_solicitud: new Date() });
          }
        } catch (err) { console.error('Error en notificación:', err); }
      });
    }
    res.redirect('/voluntarios/mi-perfil');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al registrar';
    res.redirect('/voluntarios');
  }
};

// ==========================
// 📌 GESTIONAR SOLICITUDES (UBCH/Líder)
// ==========================
exports.gestionarSolicitudes = async (req, res) => {
  try {
    const [solicitudes] = await db.query(`
      SELECT v.*, u.email FROM voluntarios v INNER JOIN usuarios u ON v.usuario_id = u.id WHERE v.estado = 'pendiente' ORDER BY v.fecha_solicitud DESC
    `);
    const [aprobados] = await db.query(`
      SELECT v.*, u.email FROM voluntarios v INNER JOIN usuarios u ON v.usuario_id = u.id WHERE v.estado = 'aprobado' ORDER BY v.nombre
    `);
    const [rechazados] = await db.query(`
      SELECT v.*, u.email FROM voluntarios v INNER JOIN usuarios u ON v.usuario_id = u.id WHERE v.estado = 'rechazado' ORDER BY v.fecha_respuesta DESC
    `);
    res.render('voluntarios/gestionar', { solicitudes, aprobados, rechazados, usuario: req.session.usuario, session: req.session });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
};

// ==========================
// 📌 APROBAR VOLUNTARIO
// ==========================
exports.aprobar = async (req, res) => {
  const { id } = req.params;
  try {
    const [vol] = await db.query('SELECT v.nombre, u.email FROM voluntarios v INNER JOIN usuarios u ON v.usuario_id = u.id WHERE v.id = ?', [id]);
    await db.query('UPDATE voluntarios SET estado = "aprobado", fecha_respuesta = NOW(), respondido_por = ? WHERE id = ?', [req.session.usuario.id, id]);
    
    setImmediate(async () => {
      if (vol[0]?.email) await enviarNotificacionVoluntario({ nombre: vol[0].nombre, email: vol[0].email }, 'aprobado');
    });
    req.session.mensaje = 'Voluntario aprobado';
    res.redirect('/voluntarios/gestionar');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error';
    res.redirect('/voluntarios/gestionar');
  }
};

// ==========================
// 📌 RECHAZAR VOLUNTARIO
// ==========================
exports.rechazar = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  try {
    const [vol] = await db.query('SELECT v.nombre, u.email FROM voluntarios v INNER JOIN usuarios u ON v.usuario_id = u.id WHERE v.id = ?', [id]);
    await db.query('UPDATE voluntarios SET estado = "rechazado", fecha_respuesta = NOW(), respondido_por = ? WHERE id = ?', [req.session.usuario.id, id]);
    
    setImmediate(async () => {
      if (vol[0]?.email) await enviarNotificacionVoluntario({ nombre: vol[0].nombre, email: vol[0].email }, 'rechazado', motivo);
    });
    req.session.mensaje = 'Voluntario rechazado';
    res.redirect('/voluntarios/gestionar');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error';
    res.redirect('/voluntarios/gestionar');
  }
};

// ==========================
// 📌 ASIGNAR VOLUNTARIO A REPORTE
// ==========================
exports.asignarVoluntarioReporte = async (req, res) => {
  const { reporte_id, voluntario_id } = req.body;
  try {
    await db.query('INSERT INTO voluntarios_reportes (voluntario_id, reporte_id, estado) VALUES (?, ?, "pendiente")', [voluntario_id, reporte_id]);
    
    setImmediate(async () => {
      try {
        const [vol] = await db.query('SELECT v.nombre, u.email FROM voluntarios v INNER JOIN usuarios u ON v.usuario_id = u.id WHERE v.id = ?', [voluntario_id]);
        const [rep] = await db.query('SELECT r.titulo, r.descripcion, r.estado, c.nombre as nombre_calle FROM reportes r INNER JOIN calles c ON r.calle_id = c.id WHERE r.id = ?', [reporte_id]);
        if (vol[0]?.email && rep[0]) {
          await enviarNotificacionAsignacionVoluntario(
            { email: vol[0].email, nombre: vol[0].nombre },
            { titulo: rep[0].titulo, descripcion: rep[0].descripcion, nombre_calle: rep[0].nombre_calle, estado: rep[0].estado }
          );
        }
      } catch (err) { console.error('Error en notificación:', err); }
    });
    req.session.mensaje = 'Voluntario asignado';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error';
    res.redirect('/reportes');
  }
};

// ==========================
// 📌 RESPONDER A ASIGNACIÓN (Voluntario)
// ==========================
exports.responderAsignacion = async (req, res) => {
  const { id } = req.params;
  const { accion } = req.body;
  try {
    await db.query('UPDATE voluntarios_reportes SET estado = ?, fecha_respuesta = NOW() WHERE id = ?', [accion, id]);
    req.session.mensaje = accion === 'aceptado' ? 'Has aceptado ayudar' : 'Has rechazado la ayuda';
    res.redirect('/voluntarios/mi-perfil');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error';
    res.redirect('/voluntarios/mi-perfil');
  }
};

// ==========================
// 📌 OBTENER VOLUNTARIOS APROBADOS (API)
// ==========================
exports.getVoluntariosAprobados = async (req, res) => {
  try {
    const [voluntarios] = await db.query('SELECT id, nombre, habilidad FROM voluntarios WHERE estado = "aprobado" ORDER BY nombre');
    res.json(voluntarios);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
};

// ==========================
// 📌 MOSTRAR EDICIÓN
// ==========================
exports.mostrarEdicion = async (req, res) => {
  try {
    const [voluntario] = await db.query('SELECT * FROM voluntarios WHERE usuario_id = ?', [req.session.usuario.id]);
    if (!voluntario.length) return res.redirect('/voluntarios');
    res.render('voluntarios/registro', { usuario: req.session.usuario, yaSolicito: true, datosVoluntario: voluntario[0], session: req.session });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
};

// ==========================
// 📌 CAMBIAR ESTADO VOLUNTARIO (UBCH/Líder)
// ==========================
exports.cambiarEstadoVoluntario = async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado } = req.body;
  try {
    await db.query('UPDATE voluntarios SET estado = ?, fecha_respuesta = NOW(), respondido_por = ? WHERE id = ?', [nuevo_estado, req.session.usuario.id, id]);
    req.session.mensaje = 'Estado actualizado';
    res.redirect('/voluntarios/gestionar');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error';
    res.redirect('/voluntarios/gestionar');
  }
};