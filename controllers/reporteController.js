const db = require('../models/db');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
const { 
  enviarNotificacionNuevoReporte, 
  enviarNotificacionCambioEstado, 
  enviarNotificacionEmpresaAsignada 
} = require('../services/emailService');

/*
  📌 Controlador de reportes OPTIMIZADO
  - Todas las notificaciones en segundo plano con setImmediate()
  - Sin bloqueos en asignaciones y cambios de estado
*/
// ==========================
// 📌 LISTAR REPORTES (VERSIÓN RÁPIDA)
// ==========================
exports.listarReportesRapido = async (req, res) => {
  const usuario = req.session.usuario;
  
  const { search, estado, categoria_id, calle_id, fecha_desde, fecha_hasta } = req.query;
  
  try {
    let query = `
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
             r.mostrar_nombre, r.imagen, r.ubicacion_lat, r.ubicacion_lng,
             r.empresa_id,
             c.nombre AS nombre_calle,
             cat.nombre AS categoria_nombre,
             cat.icono AS categoria_icono,
             cat.color AS categoria_color,
             (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS total_votos
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE r.activo = 1
    `;
    
    let params = [];

    if (!usuario) {
      return res.redirect('/login');
    }

    // ========================================
    // 📌 FILTRO POR ROL (CORREGIDO)
    // ========================================
    
    if (usuario.rol_id === 4) {
      // ✅ CIUDADANO (rol 4): SOLO sus propios reportes
      query += " AND r.usuario_id = ?";
      params.push(usuario.id);
    } 
    else if (usuario.rol_id === 3) {
      // ✅ JEFE DE CALLE (rol 3): TODOS los reportes de SU calle
      if (usuario.calle_id) {
        query += " AND r.calle_id = ?";
        params.push(usuario.calle_id);
      } else {
        // Si no tiene calle asignada, no ve nada
        query += " AND 1=0";
      }
    } 
    else if (usuario.rol_id === 2) {
      // ✅ LÍDER (rol 2): TODOS los reportes de las calles QUE LIDERA
      query += " AND r.calle_id IN (SELECT id FROM calles WHERE lider_id = ?)";
      params.push(usuario.id);
    } 
    else if (usuario.rol_id === 1) {
      // ✅ UBCH (rol 1): TODOS los reportes de las calles de SU COMUNIDAD
      query += ` AND r.calle_id IN (
        SELECT c.id 
        FROM calles c 
        INNER JOIN comunidades com ON c.comunidad_id = com.id
        INNER JOIN ubch_comunidades uc ON uc.comunidad_id = com.id
        WHERE uc.ubch_id = ?
      )`;
      params.push(usuario.id);
    }
    // SUPERADMIN (rol 5): ve TODOS los reportes (sin filtro adicional)

    // ========================================
    // 📌 FILTROS ADICIONALES (búsqueda, estado, etc.)
    // ========================================
    
    if (search && search.trim() !== '') {
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

    query += " ORDER BY r.fecha DESC LIMIT 50";
    
    const [reportes] = await db.query(query, params);
    
    let votosUsuario = {};
    if (usuario && usuario.rol_id === 4) {
      const [misVotos] = await db.query(
        'SELECT reporte_id FROM votos WHERE usuario_id = ?',
        [usuario.id]
      );
      misVotos.forEach(v => {
        votosUsuario[v.reporte_id] = true;
      });
    }
    
    const [categorias] = await db.query('SELECT id, nombre FROM categorias WHERE activo = 1 ORDER BY nombre');
      
    // ========================================
    // 📌 FILTRAR CALLES SEGÚN ROL (para el select de filtro)
    // ========================================
    let callesQuery = 'SELECT id, nombre FROM calles WHERE activo = 1';
    let callesParams = [];
    
    if (usuario.rol_id === 4) {
      // Ciudadano: ve su calle (para reportar)
      if (usuario.calle_id) {
        callesQuery += ' AND id = ?';
        callesParams.push(usuario.calle_id);
      } else {
        callesQuery += ' AND 1=0'; // No ve ninguna si no tiene calle
      }
    } 
    else if (usuario.rol_id === 3) {
      // Jefe: ve su calle
      if (usuario.calle_id) {
        callesQuery += ' AND id = ?';
        callesParams.push(usuario.calle_id);
      } else {
        callesQuery += ' AND 1=0';
      }
    } 
    else if (usuario.rol_id === 2) {
      // Líder: ve las calles que lidera
      callesQuery += ' AND lider_id = ?';
      callesParams.push(usuario.id);
    } 
    else if (usuario.rol_id === 1) {
      // UBCH: ve las calles de sus comunidades
      callesQuery += ` AND comunidad_id IN (
        SELECT comunidad_id FROM ubch_comunidades WHERE ubch_id = ?
      )`;
      callesParams.push(usuario.id);
    }
    // SuperAdmin (5): ve TODAS las calles (sin filtro adicional)
    
    const [calles] = await db.query(callesQuery, callesParams);
    
    const [empresas] = await db.query('SELECT id, nombre FROM empresas ORDER BY nombre LIMIT 20');
    
    res.render('reportes', { 
      reportes, 
      categorias,
      calles,
      empresas,
      usuario,
      votosUsuario,
      search: search || '',
      estado: estado || 'todos',
      categoria_id: categoria_id || 'todos',
      calle_id: calle_id || 'todos',
      fecha_desde: fecha_desde || '',
      fecha_hasta: fecha_hasta || '',
      session: req.session
    });
  } catch (err) {
    console.error('Error en listarReportesRapido:', err);
    res.status(500).send("Error al obtener reportes: " + err.message);
  }
};
// ==========================
// 📌 LISTAR REPORTES (ALIAS)
// ==========================
exports.listarReportes = exports.listarReportesRapido;

// ==========================
// 📌 OBTENER DETALLE DE REPORTE (para modal)
// ==========================
exports.obtenerDetalle = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [reporte] = await db.query(`
      SELECT r.id,
             r.titulo,
             r.descripcion,
             r.fecha,
             r.estado,
             r.mostrar_nombre,
             r.imagen,
             r.ubicacion_lat,
             r.ubicacion_lng,
             r.empresa_id,
             u.nombre AS nombre_usuario,
             u.telefono AS usuario_telefono,
             u.email AS usuario_email,
             j.nombre AS nombre_jefe,
             c.nombre AS nombre_calle,
             cat.id AS categoria_id,
             cat.nombre AS categoria_nombre,
             cat.icono AS categoria_icono,
             cat.color AS categoria_color,
             e.nombre AS empresa_nombre,
             e.contacto AS empresa_contacto,
             (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS total_votos,
             v_vol.nombre AS voluntario_nombre,
             v.habilidad AS voluntario_habilidad,
             v_vol.telefono AS voluntario_telefono
      FROM reportes r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      LEFT JOIN usuarios j ON r.jefe_calle_id = j.id
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      LEFT JOIN empresas e ON r.empresa_id = e.id
      LEFT JOIN voluntarios_reportes vr ON vr.reporte_id = r.id
      LEFT JOIN voluntarios v ON vr.voluntario_id = v.id
      LEFT JOIN usuarios v_vol ON v.usuario_id = v_vol.id
      WHERE r.id = ?
    `, [id]);
    
    if (reporte.length === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    
    // Asegurar que los valores tengan defaults
    const data = reporte[0];
    if (!data.categoria_nombre) data.categoria_nombre = 'Sin categoría';
    if (!data.categoria_color) data.categoria_color = 'secondary';
    if (!data.estado) data.estado = 'Pendiente';
    
    res.json(data);
  } catch (err) {
    console.error('Error en obtenerDetalle:', err);
    res.status(500).json({ error: 'Error al obtener detalle' });
  }
};

// ==========================
// 📌 FORMULARIO DE REPORTE
// ==========================
exports.mostrarFormulario = async (req, res) => {
  try {
    const usuario = req.session.usuario;
    
    if (!usuario) {
      return res.redirect('/login');
    }
    
    let calles = [];
    
    if (usuario.rol_id === 4 && usuario.calle_id) {
      const [calle] = await db.query("SELECT * FROM calles WHERE id = ?", [usuario.calle_id]);
      calles = calle;
    } 
    else if (usuario.rol_id === 3 && usuario.calle_id) {
      const [calle] = await db.query("SELECT * FROM calles WHERE id = ?", [usuario.calle_id]);
      calles = calle;
    } 
    else if (usuario.rol_id === 2) {
      const [callesLider] = await db.query("SELECT * FROM calles WHERE lider_id = ? ORDER BY nombre", [usuario.id]);
      calles = callesLider;
    } 
    else if (usuario.rol_id === 1) {
      const [todasCalles] = await db.query("SELECT * FROM calles ORDER BY nombre");
      calles = todasCalles;
    }
    
    // SOLO CATEGORÍAS ACTIVAS
    const [categorias] = await db.query("SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre");
    
    res.render("reportar", { 
      calles, 
      categorias,
      usuario: req.session.usuario,
      session: req.session 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error cargando formulario");
  }
};

// ==========================
// 📌 GUARDAR REPORTE (OPTIMIZADO)
// ==========================
exports.guardarReporte = async (req, res) => {
  const { titulo, descripcion, categoria_id, calle_id, mostrar_nombre, ubicacion_lat, ubicacion_lng } = req.body;
  const usuario = req.session.usuario;
  const imagen = req.file ? "/uploads/reportes/" + req.file.filename : null;

  try {
    const [calle] = await db.query("SELECT jefe_id, nombre FROM calles WHERE id = ?", [calle_id]);
    const jefe_id = calle[0]?.jefe_id || null;

    await db.query(
      `INSERT INTO reportes 
        (titulo, descripcion, categoria_id, usuario_id, jefe_calle_id, calle_id, mostrar_nombre, estado, fecha, imagen, ubicacion_lat, ubicacion_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', NOW(), ?, ?, ?)`,
      [
        titulo, 
        descripcion, 
        categoria_id, 
        usuario.id,
        mostrar_nombre ? null : jefe_id,
        calle_id, 
        mostrar_nombre ? 1 : 0, 
        imagen, 
        ubicacion_lat || null, 
        ubicacion_lng || null
      ]
    );

    // Obtener el reporte recién creado
    const [nuevoReporte] = await db.query(`
      SELECT r.*, c.nombre as nombre_calle, cat.nombre as categoria_nombre
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      ORDER BY r.id DESC LIMIT 1
    `);

    const reporteInfo = nuevoReporte[0];

    // ✅ NOTIFICACIONES EN SEGUNDO PLANO
    setImmediate(async () => {
      try {
        if (!mostrar_nombre && jefe_id) {
          const [jefe] = await db.query('SELECT email, nombre FROM usuarios WHERE id = ?', [jefe_id]);
          if (jefe.length > 0 && jefe[0].email) {
            await enviarNotificacionNuevoReporte(reporteInfo, jefe[0], 'jefe');
          }
        }
        
        if (mostrar_nombre) {
          const [lider] = await db.query(`
            SELECT u.email, u.nombre 
            FROM calles c
            INNER JOIN usuarios u ON c.lider_id = u.id
            WHERE c.id = ?
          `, [calle_id]);
          if (lider.length > 0 && lider[0].email) {
            await enviarNotificacionNuevoReporte(reporteInfo, lider[0], 'líder');
          }
        }
      } catch (err) {
        console.error('Error enviando notificación de nuevo reporte:', err);
      }
    });

    req.session.mensaje = 'Reporte enviado exitosamente';
    res.redirect("/reportes");
    
  } catch (err) {
    console.error('Error al guardar reporte:', err);
    req.session.error = 'Error al enviar el reporte';
    res.redirect("/reportar");
  }
};

// ==========================
// 📌 CAMBIAR ESTADO DE REPORTE (OPTIMIZADO)
// ==========================
exports.cambiarEstado = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const usuario = req.session.usuario;

  try {
    if (!usuario) return res.status(401).send("No autorizado");

    if (![1,2,3].includes(usuario.rol_id)) {
      return res.status(403).send("No autorizado para cambiar estado");
    }

    const [rows] = await db.query(`
      SELECT r.calle_id, r.estado as estado_anterior, r.usuario_id, r.titulo, r.descripcion,
             c.nombre as nombre_calle
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      WHERE r.id = ?
    `, [id]);
    
    if (rows.length === 0) return res.status(404).send("Reporte no encontrado");
    const reporte = rows[0];

    if (usuario.rol_id === 3 && reporte.calle_id !== usuario.calle_id) {
      return res.status(403).send("No autorizado");
    }

    if (usuario.rol_id === 2) {
      const [check] = await db.query("SELECT id FROM calles WHERE id = ? AND lider_id = ?", [reporte.calle_id, usuario.id]);
      if (check.length === 0) return res.status(403).send("No autorizado");
    }

    const estadosValidos = ['Pendiente', 'En Progreso', 'Resuelto'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).send("Estado no válido");
    }

    await db.query("UPDATE reportes SET estado = ? WHERE id = ?", [estado, id]);
    
    await registrarAuditoria(
      usuario,
      'CAMBIAR_ESTADO',
      'reportes',
      id,
      { estado: reporte.estado_anterior },
      { estado }
    );

    // ✅ NOTIFICACIÓN EN SEGUNDO PLANO
    setImmediate(async () => {
      try {
        const [ciudadano] = await db.query('SELECT email, nombre FROM usuarios WHERE id = ?', [reporte.usuario_id]);
        if (ciudadano.length > 0 && ciudadano[0].email && ciudadano[0].email !== usuario.email) {
          const reporteInfo = {
            titulo: reporte.titulo,
            descripcion: reporte.descripcion,
            nombre_calle: reporte.nombre_calle,
            estado: estado,
            fecha: new Date()
          };
          await enviarNotificacionCambioEstado(reporteInfo, ciudadano[0], reporte.estado_anterior, estado);
        }
      } catch (err) {
        console.error('Error enviando notificación de cambio de estado:', err);
      }
    });

    req.session.mensaje = 'Estado actualizado correctamente';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al actualizar estado");
  }
};

// ==========================
// 📌 ASIGNAR EMPRESA A REPORTE (UBCH, Líder y SuperAdmin)
// ==========================
exports.asignarEmpresa = async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.body;
  const usuario = req.session.usuario;

  try {
    if (!usuario || ![1,2,5].includes(usuario.rol_id)) {
      req.session.error = "No autorizado para asignar empresas";
      return res.redirect('/reportes');
    }

    // Obtener datos ANTES de actualizar
    const [reporteInfo] = await db.query(`
      SELECT r.titulo, c.nombre as nombre_calle, u.email as ciudadano_email, u.nombre as ciudadano_nombre
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ?
    `, [id]);
    
    const [empresa] = await db.query('SELECT nombre, contacto, telefono FROM empresas WHERE id = ?', [empresa_id]);
    
    // Actualizar rápidamente
    await db.query('UPDATE reportes SET empresa_id = ? WHERE id = ?', [empresa_id || null, id]);
    
    await registrarAuditoria(
      usuario,
      'ASIGNAR',
      'reportes',
      id,
      { empresa_id: null },
      { empresa_id, empresa_nombre: empresa[0]?.nombre }
    );

    // ✅ NOTIFICACIÓN EN SEGUNDO PLANO
    if (reporteInfo.length > 0 && empresa.length > 0 && reporteInfo[0].ciudadano_email) {
      setImmediate(async () => {
        try {
          await enviarNotificacionEmpresaAsignada(
            { titulo: reporteInfo[0].titulo, nombre_calle: reporteInfo[0].nombre_calle }, 
            { email: reporteInfo[0].ciudadano_email, nombre: reporteInfo[0].ciudadano_nombre }, 
            { nombre: empresa[0].nombre, contacto: empresa[0].contacto, telefono: empresa[0].telefono }
          );
        } catch (err) {
          console.error('Error enviando notificación de empresa asignada:', err);
        }
      });
    }

    req.session.mensaje = 'Empresa asignada correctamente';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al asignar empresa';
    res.redirect('/reportes');
  }
};

// ==========================
// 📌 REPORTES DE MI CALLE
// ==========================
exports.reportesMiCalle = async (req, res) => {
  const usuario = req.session.usuario;

  try {
    if (!usuario || usuario.rol_id !== 4) {
      return res.redirect('/login');
    }

    let calle_nombre = usuario.calle_nombre;
    if (!calle_nombre && usuario.calle_id) {
      const [calle] = await db.query('SELECT nombre FROM calles WHERE id = ?', [usuario.calle_id]);
      calle_nombre = calle[0]?.nombre || null;
    }

    if (!usuario.calle_id) {
      return res.render('reportes/mi-calle', { 
        reportes: [],
        mensaje: 'No tienes una calle asignada. Contacta al administrador.',
        usuario,
        votosUsuario: {},
        session: req.session
      });
    }

    const [reportes] = await db.query(`
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
             r.mostrar_nombre, r.imagen,
             CASE 
               WHEN r.mostrar_nombre = 1 AND u.id = ? THEN u.nombre 
               ELSE NULL 
             END AS nombre_usuario,
             c.nombre AS nombre_calle,
             cat.id AS categoria_id,
             cat.nombre AS categoria_nombre,
             cat.icono AS categoria_icono,
             cat.color AS categoria_color,
             (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS total_votos
      FROM reportes r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE r.calle_id = ?
      ORDER BY total_votos DESC, r.fecha DESC
    `, [usuario.id, usuario.calle_id]);
    
    const [misVotos] = await db.query(
      'SELECT reporte_id FROM votos WHERE usuario_id = ?',
      [usuario.id]
    );
    const votosUsuario = {};
    misVotos.forEach(v => {
      votosUsuario[v.reporte_id] = true;
    });
    
    if (!usuario.calle_nombre && calle_nombre) {
      req.session.usuario.calle_nombre = calle_nombre;
    }
    
    res.render('reportes/mi-calle', { 
      reportes, 
      usuario: {
        ...usuario,
        calle_nombre: calle_nombre
      },
      votosUsuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener reportes de tu calle");
  }
};
// ==========================
// 📌 ELIMINAR EMPRESA ASIGNADA
// ==========================
exports.eliminarEmpresa = async (req, res) => {
  const { id } = req.params;
  const usuario = req.session.usuario;

  try {
    if (!usuario || ![1,2].includes(usuario.rol_id)) {
      req.session.error = "No autorizado";
      return res.redirect('/reportes');
    }

    await db.query('UPDATE reportes SET empresa_id = NULL WHERE id = ?', [id]);
    
    await registrarAuditoria(
      usuario,
      'ELIMINAR',
      'reportes',
      id,
      { accion: 'eliminar_empresa' },
      { empresa_id: null }
    );

    req.session.mensaje = 'Empresa eliminada correctamente';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al eliminar empresa';
    res.redirect('/reportes');
  }
};

// ==========================
// 📌 ELIMINAR VOLUNTARIO ASIGNADO
// ==========================
exports.eliminarVoluntario = async (req, res) => {
  const { id } = req.params;
  const usuario = req.session.usuario;

  try {
    if (!usuario || ![1,2].includes(usuario.rol_id)) {
      req.session.error = "No autorizado";
      return res.redirect('/reportes');
    }

    await db.query('DELETE FROM voluntarios_reportes WHERE reporte_id = ?', [id]);
    
    await registrarAuditoria(
      usuario,
      'ELIMINAR',
      'voluntarios_reportes',
      id,
      { accion: 'eliminar_voluntario' },
      {}
    );

    req.session.mensaje = 'Voluntario eliminado correctamente';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al eliminar voluntario';
    res.redirect('/reportes');
  }
};
// ==========================
// 📌 LISTAR REPORTES INACTIVOS
// ==========================
exports.listarInactivos = async (req, res) => {
  try {
    const usuario = req.session.usuario;
    
    // Solo UBCH y SuperAdmin pueden ver inactivos
    if (!usuario || ![1, 5].includes(usuario.rol_id)) {
      return res.status(403).send('No autorizado');
    }
    
    const [reportes] = await db.query(`
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
             r.motivo_inactivo,
             c.nombre AS nombre_calle,
             cat.nombre AS categoria_nombre,
             cat.icono AS categoria_icono,
             u.nombre AS nombre_usuario,
             r.activo
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.activo = 0
      ORDER BY r.fecha DESC
    `);
    
    res.render('reportes/inactivos', {
      reportes,
      usuario,
      session: req.session
    });
  } catch (err) {
    console.error('Error en listarInactivos:', err);
    res.status(500).send('Error al cargar reportes inactivos');
  }
};

// ==========================
// 📌 DESACTIVAR REPORTE (UBCH y SuperAdmin)
// ==========================
exports.desactivarReporte = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  const usuario = req.session.usuario;

  try {
    if (!usuario || ![1, 5].includes(usuario.rol_id)) {
      req.session.error = 'No autorizado';
      return res.redirect('/reportes');
    }

    // Verificar que el reporte existe y está activo
    const [reporte] = await db.query('SELECT id, titulo FROM reportes WHERE id = ? AND activo = 1', [id]);
    if (reporte.length === 0) {
      req.session.error = 'Reporte no encontrado o ya está inactivo';
      return res.redirect('/reportes');
    }

    // Verificar si el motivo está presente
    if (!motivo || motivo.trim() === '') {
      req.session.error = 'Debe especificar un motivo para desactivar el reporte';
      return res.redirect('/reportes');
    }

    await db.query(
      'UPDATE reportes SET activo = 0, motivo_inactivo = ? WHERE id = ?',
      [motivo.trim(), id]
    );

    await registrarAuditoria(
      usuario,
      'DESACTIVAR',
      'reportes',
      id,
      { accion: 'desactivar_reporte', titulo: reporte[0].titulo },
      { motivo: motivo.trim() }
    );

    req.session.mensaje = `Reporte "${reporte[0].titulo}" desactivado correctamente`;
    res.redirect('/reportes');
  } catch (err) {
    console.error('Error al desactivar reporte:', err);
    req.session.error = 'Error al desactivar el reporte';
    res.redirect('/reportes');
  }
};

// ==========================
// 📌 ACTIVAR REPORTE (UBCH o SuperAdmin)
// ==========================
exports.activarReporte = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  const usuario = req.session.usuario;

  try {
    if (!usuario || ![1, 5].includes(usuario.rol_id)) {
      req.session.error = 'No autorizado';
      return res.redirect('/reportes/inactivos');
    }

    await db.query(
      'UPDATE reportes SET activo = 1, motivo_inactivo = NULL WHERE id = ?',
      [id]
    );

    await registrarAuditoria(
      usuario,
      'ACTIVAR',
      'reportes',
      id,
      { accion: 'reactivar_reporte' },
      { motivo: motivo || 'Reactivado por administración' }
    );

    req.session.mensaje = 'Reporte reactivado correctamente';
    res.redirect('/reportes/inactivos');
  } catch (err) {
    console.error('Error al activar reporte:', err);
    req.session.error = 'Error al activar el reporte';
    res.redirect('/reportes/inactivos');
  }
};

// ==========================
// 📌 ELIMINAR PERMANENTEMENTE (SOLO SuperAdmin)
// ==========================
exports.destruirReporte = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  const usuario = req.session.usuario;

  try {
    if (!usuario || usuario.rol_id !== 5) {
      req.session.error = 'No autorizado';
      return res.redirect('/reportes/inactivos');
    }

    // Obtener datos antes de eliminar
    const [reporte] = await db.query('SELECT titulo FROM reportes WHERE id = ?', [id]);
    if (reporte.length === 0) {
      req.session.error = 'Reporte no encontrado';
      return res.redirect('/reportes/inactivos');
    }

    // Eliminar votos asociados
    await db.query('DELETE FROM votos WHERE reporte_id = ?', [id]);
    
    // Eliminar asignaciones de voluntarios
    await db.query('DELETE FROM voluntarios_reportes WHERE reporte_id = ?', [id]);
    
    // Eliminar el reporte
    await db.query('DELETE FROM reportes WHERE id = ?', [id]);

    await registrarAuditoria(
      usuario,
      'ELIMINAR_PERMANENTEMENTE',
      'reportes',
      id,
      { titulo: reporte[0].titulo },
      { motivo: motivo || 'Eliminado permanentemente' }
    );

    req.session.mensaje = 'Reporte eliminado permanentemente';
    res.redirect('/reportes/inactivos');
  } catch (err) {
    console.error('Error al destruir reporte:', err);
    req.session.error = 'Error al eliminar el reporte';
    res.redirect('/reportes/inactivos');
  }
};