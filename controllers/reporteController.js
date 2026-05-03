const db = require('../models/db');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
const { 
  enviarNotificacionNuevoReporte, 
  enviarNotificacionCambioEstado, 
  enviarNotificacionEmpresaAsignada 
} = require('../services/emailService');

// ==========================
// 📌 LISTAR REPORTES (OPTIMIZADO)
// ==========================
exports.listarReportes = async (req, res) => {
  const usuario = req.session.usuario;
  const { search, estado, categoria_id, calle_id, fecha_desde, fecha_hasta } = req.query;
  
  try {
    let query = `
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
             r.mostrar_nombre, r.imagen, r.ubicacion_lat, r.ubicacion_lng,
             r.empresa_id,
             u.nombre AS nombre_usuario,
             c.nombre AS nombre_calle,
             cat.nombre AS categoria_nombre,
             cat.icono AS categoria_icono,
             cat.color AS categoria_color,
             (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS total_votos
      FROM reportes r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE 1=1
    `;
    
    let params = [];

    if (!usuario) return res.redirect('/login');

    if (usuario.rol_id === 3 && usuario.calle_id) {
      query += " AND r.calle_id = ?";
      params.push(usuario.calle_id);
    } 
    else if (usuario.rol_id === 2) {
      query += " AND r.calle_id IN (SELECT id FROM calles WHERE lider_id = ?)";
      params.push(usuario.id);
    } 
    else if (usuario.rol_id === 4 && usuario.calle_id) {
      query += " AND r.calle_id = ?";
      params.push(usuario.calle_id);
    }
    else if (usuario.rol_id === 4) {
      query += " AND r.usuario_id = ?";
      params.push(usuario.id);
    }

    if (search?.trim()) {
      query += " AND (r.titulo LIKE ? OR r.descripcion LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (estado && estado !== 'todos') {
      query += " AND r.estado = ?";
      params.push(estado);
    }
    if (categoria_id && categoria_id !== 'todos') {
      query += " AND r.categoria_id = ?";
      params.push(categoria_id);
    }
    if (calle_id && calle_id !== 'todos') {
      query += " AND r.calle_id = ?";
      params.push(calle_id);
    }
    if (fecha_desde) {
      query += " AND DATE(r.fecha) >= ?";
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += " AND DATE(r.fecha) <= ?";
      params.push(fecha_hasta);
    }

    query += " ORDER BY r.fecha DESC LIMIT 100";
    
    const [reportes] = await db.query(query, params);
    
    // Obtener nombres de empresas (solo los IDs necesarios)
    const empresasIds = [...new Set(reportes.filter(r => r.empresa_id).map(r => r.empresa_id))];
    if (empresasIds.length > 0) {
      const [empresas] = await db.query(
        `SELECT id, nombre, contacto FROM empresas WHERE id IN (${empresasIds.map(() => '?').join(',')})`,
        empresasIds
      );
      const empresasMap = Object.fromEntries(empresas.map(e => [e.id, { nombre: e.nombre, contacto: e.contacto }]));
      reportes.forEach(r => {
        if (r.empresa_id && empresasMap[r.empresa_id]) {
          r.empresa_nombre = empresasMap[r.empresa_id].nombre;
          r.empresa_contacto = empresasMap[r.empresa_id].contacto;
        }
      });
    }
    
    // Votos del usuario
    let votosUsuario = {};
    if (usuario?.rol_id === 4) {
      const [misVotos] = await db.query(
        'SELECT reporte_id FROM votos WHERE usuario_id = ?',
        [usuario.id]
      );
      misVotos.forEach(v => { votosUsuario[v.reporte_id] = true; });
    }
    
    const [empresas] = await db.query('SELECT id, nombre FROM empresas ORDER BY nombre LIMIT 20');
    const [categorias] = await db.query('SELECT id, nombre, icono, color FROM categorias ORDER BY nombre');
    const [calles] = await db.query('SELECT id, nombre FROM calles ORDER BY nombre');
    
    res.render('reportes', { 
      reportes, empresas, categorias, calles, usuario, votosUsuario,
      search, estado, categoria_id, calle_id, fecha_desde, fecha_hasta, session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener reportes");
  }
};

// ==========================
// 📌 GUARDAR REPORTE (con notificaciones en segundo plano)
// ==========================
exports.guardarReporte = async (req, res) => {
  const { titulo, descripcion, categoria_id, calle_id, mostrar_nombre, ubicacion_lat, ubicacion_lng } = req.body;
  const usuario = req.session.usuario;
  const imagen = req.file ? "/uploads/reportes/" + req.file.filename : null;

  try {
    const [calle] = await db.query("SELECT jefe_id, nombre FROM calles WHERE id = ?", [calle_id]);
    const jefe_id = calle[0]?.jefe_id || null;

    const [result] = await db.query(
      `INSERT INTO reportes 
        (titulo, descripcion, categoria_id, usuario_id, jefe_calle_id, calle_id, mostrar_nombre, estado, fecha, imagen, ubicacion_lat, ubicacion_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', NOW(), ?, ?, ?)`,
      [titulo, descripcion, categoria_id, usuario.id, mostrar_nombre ? null : jefe_id, calle_id, mostrar_nombre ? 1 : 0, imagen, ubicacion_lat || null, ubicacion_lng || null]
    );

    const nuevoId = result.insertId;

    // Notificaciones en segundo plano
    setImmediate(async () => {
      try {
        const [nuevoReporte] = await db.query(`
          SELECT r.*, c.nombre as nombre_calle, cat.nombre as categoria_nombre
          FROM reportes r
          INNER JOIN calles c ON r.calle_id = c.id
          INNER JOIN categorias cat ON r.categoria_id = cat.id
          WHERE r.id = ?
        `, [nuevoId]);
        
        if (!mostrar_nombre && jefe_id) {
          const [jefe] = await db.query('SELECT email, nombre FROM usuarios WHERE id = ?', [jefe_id]);
          if (jefe[0]?.email) await enviarNotificacionNuevoReporte(nuevoReporte[0], jefe[0], 'jefe');
        }
        if (mostrar_nombre) {
          const [lider] = await db.query(`
            SELECT u.email, u.nombre FROM calles c
            INNER JOIN usuarios u ON c.lider_id = u.id WHERE c.id = ?
          `, [calle_id]);
          if (lider[0]?.email) await enviarNotificacionNuevoReporte(nuevoReporte[0], lider[0], 'líder');
        }
      } catch (err) { console.error('Error en notificación:', err); }
    });

    req.session.mensaje = 'Reporte enviado exitosamente';
    res.redirect("/reportes");
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al enviar el reporte';
    res.redirect("/reportar");
  }
};

// ==========================
// 📌 CAMBIAR ESTADO (con notificaciones en segundo plano)
// ==========================
exports.cambiarEstado = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const usuario = req.session.usuario;

  try {
    if (!usuario || ![1,2,3].includes(usuario.rol_id)) return res.status(403).send("No autorizado");

    const [reporte] = await db.query(`
      SELECT r.calle_id, r.estado as estado_anterior, r.usuario_id, r.titulo, r.descripcion, c.nombre as nombre_calle
      FROM reportes r INNER JOIN calles c ON r.calle_id = c.id WHERE r.id = ?
    `, [id]);
    
    if (!reporte.length) return res.status(404).send("Reporte no encontrado");

    if ((usuario.rol_id === 3 && reporte[0].calle_id !== usuario.calle_id) ||
        (usuario.rol_id === 2 && (await db.query("SELECT id FROM calles WHERE id = ? AND lider_id = ?", [reporte[0].calle_id, usuario.id]))[0].length === 0)) {
      return res.status(403).send("No autorizado");
    }

    await db.query("UPDATE reportes SET estado = ? WHERE id = ?", [estado, id]);
    await registrarAuditoria(usuario, 'CAMBIAR_ESTADO', 'reportes', id, { estado: reporte[0].estado_anterior }, { estado });

    // Notificación en segundo plano
    setImmediate(async () => {
      try {
        const [ciudadano] = await db.query('SELECT email, nombre FROM usuarios WHERE id = ?', [reporte[0].usuario_id]);
        if (ciudadano[0]?.email && ciudadano[0].email !== usuario.email) {
          await enviarNotificacionCambioEstado(
            { titulo: reporte[0].titulo, descripcion: reporte[0].descripcion, nombre_calle: reporte[0].nombre_calle, estado, fecha: new Date() },
            ciudadano[0], reporte[0].estado_anterior, estado
          );
        }
      } catch (err) { console.error('Error en notificación:', err); }
    });

    req.session.mensaje = 'Estado actualizado correctamente';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al actualizar estado");
  }
};

// ==========================
// 📌 ASIGNAR EMPRESA (con notificaciones en segundo plano)
// ==========================
exports.asignarEmpresa = async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.body;
  const usuario = req.session.usuario;

  try {
    if (!usuario || ![1,2].includes(usuario.rol_id)) {
      req.session.error = "No autorizado";
      return res.redirect('/reportes');
    }

    const [reporteInfo] = await db.query(`
      SELECT r.titulo, c.nombre as nombre_calle, u.email as ciudadano_email, u.nombre as ciudadano_nombre
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ?
    `, [id]);
    
    const [empresa] = await db.query('SELECT nombre, contacto, telefono FROM empresas WHERE id = ?', [empresa_id]);
    
    await db.query('UPDATE reportes SET empresa_id = ? WHERE id = ?', [empresa_id || null, id]);
    await registrarAuditoria(usuario, 'ASIGNAR', 'reportes', id, { empresa_id: null }, { empresa_id, empresa_nombre: empresa[0]?.nombre });

    // Notificación en segundo plano
    setImmediate(async () => {
      try {
        if (reporteInfo[0]?.ciudadano_email && empresa[0]) {
          await enviarNotificacionEmpresaAsignada(
            { titulo: reporteInfo[0].titulo },
            { email: reporteInfo[0].ciudadano_email, nombre: reporteInfo[0].ciudadano_nombre },
            { nombre: empresa[0].nombre, contacto: empresa[0].contacto, telefono: empresa[0].telefono }
          );
        }
      } catch (err) { console.error('Error en notificación:', err); }
    });

    req.session.mensaje = 'Empresa asignada correctamente';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al asignar empresa';
    res.redirect('/reportes');
  }
};

// ==========================
// 📌 OBTENER DETALLE (rápido)
// ==========================
exports.obtenerDetalle = async (req, res) => {
  const { id } = req.params;
  try {
    const [reporte] = await db.query(`
      SELECT r.*, u.nombre AS nombre_usuario, c.nombre AS nombre_calle,
             cat.nombre AS categoria_nombre, cat.icono AS categoria_icono, cat.color AS categoria_color,
             e.nombre AS empresa_nombre, e.contacto AS empresa_contacto,
             (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS total_votos
      FROM reportes r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      LEFT JOIN empresas e ON r.empresa_id = e.id
      WHERE r.id = ?
    `, [id]);
    
    if (!reporte.length) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json(reporte[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener detalle' });
  }
};

// ==========================
// 📌 FORMULARIO DE REPORTE
// ==========================
exports.mostrarFormulario = async (req, res) => {
  try {
    const usuario = req.session.usuario;
    if (!usuario) return res.redirect('/login');
    
    let calles = [];
    if (usuario.rol_id === 4 && usuario.calle_id) {
      const [calle] = await db.query("SELECT * FROM calles WHERE id = ?", [usuario.calle_id]);
      calles = calle;
    } else if (usuario.rol_id === 3 && usuario.calle_id) {
      const [calle] = await db.query("SELECT * FROM calles WHERE id = ?", [usuario.calle_id]);
      calles = calle;
    } else if (usuario.rol_id === 2) {
      const [callesLider] = await db.query("SELECT * FROM calles WHERE lider_id = ? ORDER BY nombre", [usuario.id]);
      calles = callesLider;
    } else {
      const [todasCalles] = await db.query("SELECT * FROM calles ORDER BY nombre");
      calles = todasCalles;
    }
    
    const [categorias] = await db.query("SELECT * FROM categorias ORDER BY nombre");
    res.render("reportar", { calles, categorias, usuario: req.session.usuario, session: req.session });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error cargando formulario");
  }
};

// ==========================
// 📌 REPORTES DE MI CALLE (para ciudadanos)
// ==========================
exports.reportesMiCalle = async (req, res) => {
  const usuario = req.session.usuario;
  if (!usuario || usuario.rol_id !== 4) return res.redirect('/login');
  if (!usuario.calle_id) {
    return res.render('reportes/mi-calle', { reportes: [], mensaje: 'No tienes una calle asignada.', usuario, votosUsuario: {}, session: req.session });
  }

  try {
    const [reportes] = await db.query(`
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado, r.mostrar_nombre, r.imagen,
             c.nombre AS nombre_calle, cat.nombre AS categoria_nombre, cat.icono AS categoria_icono, cat.color AS categoria_color,
             (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS total_votos
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE r.calle_id = ?
      ORDER BY r.fecha DESC
    `, [usuario.calle_id]);
    
    const [misVotos] = await db.query('SELECT reporte_id FROM votos WHERE usuario_id = ?', [usuario.id]);
    const votosUsuario = Object.fromEntries(misVotos.map(v => [v.reporte_id, true]));
    
    res.render('reportes/mi-calle', { reportes, usuario, votosUsuario, session: req.session });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener reportes");
  }
};

// ==========================
// 📌 LISTAR REPORTES RÁPIDO
// ==========================
exports.listarReportesRapido = async (req, res) => {
  const usuario = req.session.usuario;
  const { search, estado, categoria_id, calle_id, fecha_desde, fecha_hasta } = req.query;
  
  try {
    let query = `
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado, r.mostrar_nombre, r.imagen,
             c.nombre AS nombre_calle, cat.nombre AS categoria_nombre, cat.icono AS categoria_icono, cat.color AS categoria_color,
             (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS total_votos
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE 1=1
    `;
    let params = [];

    if (!usuario) return res.redirect('/login');
    if (usuario.rol_id === 3 && usuario.calle_id) {
      query += " AND r.calle_id = ?";
      params.push(usuario.calle_id);
    } else if (usuario.rol_id === 2) {
      query += " AND r.calle_id IN (SELECT id FROM calles WHERE lider_id = ?)";
      params.push(usuario.id);
    } else if (usuario.rol_id === 4 && usuario.calle_id) {
      query += " AND r.calle_id = ?";
      params.push(usuario.calle_id);
    } else if (usuario.rol_id === 4) {
      query += " AND r.usuario_id = ?";
      params.push(usuario.id);
    }

    if (search?.trim()) {
      query += " AND (r.titulo LIKE ? OR r.descripcion LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (estado && estado !== 'todos') {
      query += " AND r.estado = ?";
      params.push(estado);
    }
    if (categoria_id && categoria_id !== 'todos') {
      query += " AND r.categoria_id = ?";
      params.push(categoria_id);
    }
    if (calle_id && calle_id !== 'todos') {
      query += " AND r.calle_id = ?";
      params.push(calle_id);
    }
    if (fecha_desde) params.push(fecha_desde);
    if (fecha_hasta) params.push(fecha_hasta);

    query += " ORDER BY r.fecha DESC LIMIT 50";
    const [reportes] = await db.query(query, params);
    
    let votosUsuario = {};
    if (usuario?.rol_id === 4) {
      const [misVotos] = await db.query('SELECT reporte_id FROM votos WHERE usuario_id = ?', [usuario.id]);
      misVotos.forEach(v => { votosUsuario[v.reporte_id] = true; });
    }
    
    const [categorias] = await db.query('SELECT id, nombre FROM categorias ORDER BY nombre');
    const [calles] = await db.query('SELECT id, nombre FROM calles ORDER BY nombre');
    
    res.render('reportes', { 
      reportes, categorias, calles, empresas: [], usuario, votosUsuario,
      search: search || '', estado: estado || 'todos', categoria_id: categoria_id || 'todos',
      calle_id: calle_id || 'todos', fecha_desde: fecha_desde || '', fecha_hasta: fecha_hasta || '', session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener reportes");
  }
};