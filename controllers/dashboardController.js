const db = require('../models/db');

// ==========================
// 📌 DASHBOARD ADMIN (UBCH) CON ESTADÍSTICAS - CORREGIDO
// ==========================
exports.admin = async (req, res) => {
  console.log("📊 Dashboard Admin iniciado");
  const usuario = req.session.usuario;
  
  try {
    // Obtener las comunidades que atiende este UBCH
    const [comunidades] = await db.query(`
      SELECT comunidad_id FROM ubch_comunidades WHERE ubch_id = ?
    `, [usuario.id]);
    
    const comunidadesIds = comunidades.map(c => c.comunidad_id);
    console.log("📍 Comunidades que atiende:", comunidadesIds);
    
    let comunidadFilter = '';
    let params = [];
    
    if (comunidadesIds.length > 0) {
      comunidadFilter = ' AND c.comunidad_id IN (?) ';
      params.push(comunidadesIds);
    } else {
      // Si no tiene comunidades asignadas, no mostrar datos
      comunidadFilter = ' AND 1=0 ';
    }

    // 1. Reportes por categoría (solo de sus comunidades)
    let porCategoria = [];
    try {
      const [rows] = await db.query(`
        SELECT cat.nombre, COUNT(*) as total
        FROM reportes r
        INNER JOIN categorias cat ON r.categoria_id = cat.id
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.activo = 1 ${comunidadFilter}
        GROUP BY cat.id, cat.nombre
        ORDER BY total DESC
      `, params);
      porCategoria = rows;
      console.log("✅ Categorías:", porCategoria.length);
    } catch (err) {
      console.error("❌ Error en categorías:", err.message);
    }

    // 2. Reportes por estado (solo de sus comunidades)
    let porEstado = [];
    try {
      const [rows] = await db.query(`
        SELECT r.estado, COUNT(*) as total
        FROM reportes r
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.activo = 1 ${comunidadFilter}
        GROUP BY r.estado
      `, params);
      porEstado = rows;
      console.log("✅ Estados:", porEstado.length);
    } catch (err) {
      console.error("❌ Error en estados:", err.message);
    }

    // 3. Reportes por calle (top 5) (solo de sus comunidades)
    let porCalle = [];
    try {
      const [rows] = await db.query(`
        SELECT c.nombre, COUNT(r.id) as total
        FROM reportes r
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.activo = 1 ${comunidadFilter}
        GROUP BY c.id, c.nombre
        ORDER BY total DESC
        LIMIT 5
      `, params);
      porCalle = rows;
      console.log("✅ Calles:", porCalle.length);
    } catch (err) {
      console.error("❌ Error en calles:", err.message);
    }

    // 4. Totales generales (solo de sus comunidades)
    let totales = {
      total_reportes: 0,
      pendientes: 0,
      en_progreso: 0,
      resueltos: 0,
      total_ciudadanos: 0,
      total_voluntarios: 0
    };
    
    try {
      const [totalRows] = await db.query(`
        SELECT COUNT(*) as total FROM reportes r
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.activo = 1 ${comunidadFilter}
      `, params);
      totales.total_reportes = totalRows[0]?.total || 0;
      
      const [pendRows] = await db.query(`
        SELECT COUNT(*) as total FROM reportes r
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.estado = 'Pendiente' AND r.activo = 1 ${comunidadFilter}
      `, params);
      totales.pendientes = pendRows[0]?.total || 0;
      
      const [progRows] = await db.query(`
        SELECT COUNT(*) as total FROM reportes r
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.estado = 'En Progreso' AND r.activo = 1 ${comunidadFilter}
      `, params);
      totales.en_progreso = progRows[0]?.total || 0;
      
      const [resRows] = await db.query(`
        SELECT COUNT(*) as total FROM reportes r
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.estado = 'Resuelto' AND r.activo = 1 ${comunidadFilter}
      `, params);
      totales.resueltos = resRows[0]?.total || 0;
      
      // Ciudadanos de sus calles
      const [ciuRows] = await db.query(`
        SELECT COUNT(DISTINCT u.id) as total FROM usuarios u
        INNER JOIN calles c ON u.calle_id = c.id
        WHERE c.comunidad_id IN (?) AND u.rol_id = 4 AND u.activo = 1
      `, [comunidadesIds]);
      totales.total_ciudadanos = ciuRows[0]?.total || 0;
      
      // Voluntarios APROBADOS de sus calles
      const [volRows] = await db.query(`
        SELECT COUNT(DISTINCT v.id) as total FROM voluntarios v
        INNER JOIN usuarios u ON v.usuario_id = u.id
        INNER JOIN calles c ON u.calle_id = c.id
        WHERE c.comunidad_id IN (?) AND v.estado = 'aprobado'
      `, [comunidadesIds]);
      totales.total_voluntarios = volRows[0]?.total || 0;
      
      console.log("✅ Totales calculados");
    } catch (err) {
      console.error("❌ Error en totales:", err.message);
    }

    // 5. Reportes más votados (solo de sus comunidades)
    let masVotados = [];
    try {
      const [rows] = await db.query(`
        SELECT r.id, r.titulo, cat.nombre as categoria, c.nombre as calle, COUNT(v.id) as votos
        FROM reportes r
        LEFT JOIN votos v ON r.id = v.reporte_id
        INNER JOIN categorias cat ON r.categoria_id = cat.id
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.activo = 1 ${comunidadFilter}
        GROUP BY r.id, r.titulo, cat.nombre, c.nombre
        ORDER BY votos DESC
        LIMIT 5
      `, params);
      masVotados = rows;
      console.log("✅ Más votados:", masVotados.length);
    } catch (err) {
      console.error("❌ Error en votados:", err.message);
    }

    res.render('dashboards/admin', { 
      usuario: req.session.usuario,
      session: req.session,
      porCategoria,
      porEstado,
      porCalle,
      masVotados,
      totales
    });
    
  } catch (err) {
    console.error("❌ Error FATAL en admin:", err);
    res.status(500).send("Error al cargar el dashboard: " + err.message);
  }
};

// ==========================
// 📌 DASHBOARD LÍDER - CORREGIDO
// ==========================
exports.lider = async (req, res) => {
  const usuario = req.session.usuario;
  console.log("📊 Dashboard Líder iniciado para usuario:", usuario?.id);
  
  try {
    // 1. Obtener las calles que lidera
    const [misCalles] = await db.query(`
      SELECT id, nombre 
      FROM calles 
      WHERE lider_id = ? AND activo = 1
      ORDER BY nombre
    `, [usuario.id]);
    
    const idsCalles = misCalles.map(c => c.id);
    console.log("📍 Calles que lidera:", idsCalles);
    
    if (idsCalles.length === 0) {
      console.log("⚠️ El líder no tiene calles asignadas");
      return res.render('dashboards/lider', { 
        usuario,
        misCalles: [],
        porCategoria: [],
        porEstado: [],
        topCalles: [],
        voluntarios: [],
        reportesRecientes: [],
        totales: {
          total_reportes: 0,
          pendientes: 0,
          en_progreso: 0,
          resueltos: 0
        },
        session: req.session
      });
    }

    // 2. Reportes por categoría en sus calles (para gráfico)
    const [porCategoria] = await db.query(`
      SELECT cat.nombre, COUNT(*) as total
      FROM reportes r
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE r.calle_id IN (?) AND r.activo = 1
      GROUP BY cat.id, cat.nombre
      ORDER BY total DESC
    `, [idsCalles]);
    console.log("📊 Categorías:", porCategoria.length);

    // 3. Reportes por estado en sus calles (para gráfico)
    const [porEstado] = await db.query(`
      SELECT estado, COUNT(*) as total
      FROM reportes
      WHERE calle_id IN (?) AND activo = 1
      GROUP BY estado
    `, [idsCalles]);
    console.log("📊 Estados:", porEstado.length);

    // 4. Top 5 calles con más reportes
    const [topCalles] = await db.query(`
      SELECT c.nombre, COUNT(r.id) as total
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      WHERE r.calle_id IN (?) AND r.activo = 1
      GROUP BY c.id, c.nombre
      ORDER BY total DESC
      LIMIT 5
    `, [idsCalles]);
    console.log("📊 Top Calles:", topCalles.length);

    // 5. Voluntarios APROBADOS en sus calles
    const [voluntarios] = await db.query(`
      SELECT DISTINCT u.nombre, v.habilidad, u.telefono
      FROM voluntarios v
      INNER JOIN usuarios u ON v.usuario_id = u.id
      WHERE u.calle_id IN (?) AND v.estado = 'aprobado'
      LIMIT 5
    `, [idsCalles]);
    console.log("📊 Voluntarios:", voluntarios.length);

    // 6. Reportes recientes en sus calles (últimos 5)
    const [reportesRecientes] = await db.query(`
      SELECT r.id, r.titulo, r.fecha, r.estado,
             c.nombre as calle,
             cat.nombre as categoria
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE r.calle_id IN (?) AND r.activo = 1
      ORDER BY r.fecha DESC
      LIMIT 5
    `, [idsCalles]);
    console.log("📊 Reportes Recientes:", reportesRecientes.length);

    // 7. Totales generales en sus calles
    const [totales] = await db.query(`
      SELECT 
        COUNT(*) as total_reportes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado = 'En Progreso' THEN 1 ELSE 0 END) as en_progreso,
        SUM(CASE WHEN estado = 'Resuelto' THEN 1 ELSE 0 END) as resueltos
      FROM reportes
      WHERE calle_id IN (?) AND activo = 1
    `, [idsCalles]);
    console.log("📊 Totales:", totales[0]);

    // Preparar datos para el gráfico
    const nombresCalles = misCalles.map(c => c.nombre);

    res.render('dashboards/lider', { 
      usuario,
      misCalles,
      nombresCalles: JSON.stringify(nombresCalles),
      porCategoria: porCategoria || [],
      porEstado: porEstado || [],
      topCalles: topCalles || [],
      voluntarios: voluntarios || [],
      reportesRecientes: reportesRecientes || [],
      totales: totales[0] || { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 },
      session: req.session
    });

  } catch (err) {
    console.error("❌ Error FATAL en lider:", err);
    res.status(500).render('dashboards/lider', { 
      usuario: req.session.usuario || null,
      misCalles: [],
      porCategoria: [],
      porEstado: [],
      topCalles: [],
      voluntarios: [],
      reportesRecientes: [],
      totales: { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 },
      session: req.session,
      error: err.message
    });
  }
};

// ==========================
// 📌 DASHBOARD JEFE DE CALLE (simplificado)
// ==========================
exports.jefe = async (req, res) => {
  const usuario = req.session.usuario;
  console.log("📊 Dashboard Jefe iniciado para usuario:", usuario?.id, "calle_id:", usuario?.calle_id);
  
  try {
    // Si no tiene calle asignada
    if (!usuario || !usuario.calle_id) {
      return res.render('dashboards/jefe', { 
        usuario: usuario || null,
        session: req.session,
        tieneCalle: false,
        miCalle: null,
        porCategoria: [],
        porEstado: [],
        reportesRecientes: [],
        totales: { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 },
        reporteMasVotado: null,
        reporteMasAntiguo: null
      });
    }

    // Obtener nombre de la calle
    let miCalle = "Sin nombre";
    try {
      const [rows] = await db.query(`SELECT nombre FROM calles WHERE id = ?`, [usuario.calle_id]);
      if (rows.length > 0) miCalle = rows[0].nombre;
    } catch (err) {
      console.error("❌ Error obteniendo calle:", err.message);
    }

    // Reportes por categoría (solo activos)
    let porCategoria = [];
    try {
      const [rows] = await db.query(`
        SELECT cat.nombre, COUNT(*) as total
        FROM reportes r
        INNER JOIN categorias cat ON r.categoria_id = cat.id
        WHERE r.calle_id = ? AND r.activo = 1
        GROUP BY cat.id, cat.nombre
        ORDER BY total DESC
      `, [usuario.calle_id]);
      porCategoria = rows;
    } catch (err) {
      console.error("❌ Error en categorías jefe:", err.message);
    }

    // Reportes por estado (solo activos)
    let porEstado = [];
    try {
      const [rows] = await db.query(`
        SELECT estado, COUNT(*) as total
        FROM reportes
        WHERE calle_id = ? AND activo = 1
        GROUP BY estado
      `, [usuario.calle_id]);
      porEstado = rows;
    } catch (err) {
      console.error("❌ Error en estados jefe:", err.message);
    }

    // Reportes recientes (solo activos)
    let reportesRecientes = [];
    try {
      const [rows] = await db.query(`
        SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
               cat.nombre as categoria, u.nombre as reportado_por
        FROM reportes r
        INNER JOIN categorias cat ON r.categoria_id = cat.id
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        WHERE r.calle_id = ? AND r.activo = 1
        ORDER BY r.fecha DESC
        LIMIT 5
      `, [usuario.calle_id]);
      reportesRecientes = rows;
    } catch (err) {
      console.error("❌ Error en reportes recientes jefe:", err.message);
    }

    // Totales (solo activos)
    let totales = { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 };
    try {
      const [totalRow] = await db.query(`
        SELECT COUNT(*) as total FROM reportes 
        WHERE calle_id = ? AND activo = 1
      `, [usuario.calle_id]);
      totales.total_reportes = totalRow[0]?.total || 0;
      
      const [pendRow] = await db.query(`
        SELECT COUNT(*) as total FROM reportes 
        WHERE calle_id = ? AND estado = 'Pendiente' AND activo = 1
      `, [usuario.calle_id]);
      totales.pendientes = pendRow[0]?.total || 0;
      
      const [progRow] = await db.query(`
        SELECT COUNT(*) as total FROM reportes 
        WHERE calle_id = ? AND estado = 'En Progreso' AND activo = 1
      `, [usuario.calle_id]);
      totales.en_progreso = progRow[0]?.total || 0;
      
      const [resRow] = await db.query(`
        SELECT COUNT(*) as total FROM reportes 
        WHERE calle_id = ? AND estado = 'Resuelto' AND activo = 1
      `, [usuario.calle_id]);
      totales.resueltos = resRow[0]?.total || 0;
    } catch (err) {
      console.error("❌ Error en totales jefe:", err.message);
    }

    // 📌 Reporte más votado
    let reporteMasVotado = null;
    try {
      const [rows] = await db.query(`
        SELECT r.id, r.titulo, r.descripcion, 
               (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS votos
        FROM reportes r
        WHERE r.calle_id = ? AND r.activo = 1
        ORDER BY votos DESC
        LIMIT 1
      `, [usuario.calle_id]);
      reporteMasVotado = rows[0] || null;
    } catch (err) {
      console.error("❌ Error en reporte más votado jefe:", err.message);
    }

    // 📌 Reporte más antiguo
    let reporteMasAntiguo = null;
    try {
      const [rows] = await db.query(`
        SELECT r.id, r.titulo, r.fecha, r.estado
        FROM reportes r
        WHERE r.calle_id = ? AND r.activo = 1
        ORDER BY r.fecha ASC
        LIMIT 1
      `, [usuario.calle_id]);
      reporteMasAntiguo = rows[0] || null;
    } catch (err) {
      console.error("❌ Error en reporte más antiguo jefe:", err.message);
    }

    res.render('dashboards/jefe', { 
      usuario: usuario,
      session: req.session,
      tieneCalle: true,
      miCalle: miCalle,
      porCategoria: porCategoria,
      porEstado: porEstado,
      reportesRecientes: reportesRecientes,
      totales: totales,
      reporteMasVotado: reporteMasVotado,
      reporteMasAntiguo: reporteMasAntiguo
    });
    
  } catch (err) {
    console.error("❌ Error FATAL en jefe:", err);
    res.status(500).render('dashboards/jefe', { 
      usuario: req.session?.usuario || null,
      session: req.session,
      tieneCalle: false,
      miCalle: null,
      porCategoria: [],
      porEstado: [],
      reportesRecientes: [],
      totales: { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 },
      reporteMasVotado: null,
      reporteMasAntiguo: null,
      error: err.message
    });
  }
};

// ==========================
// 📌 DASHBOARD SUPERADMINISTRADOR (completo)
// ==========================
exports.superAdmin = async (req, res) => {
  const usuario = req.session.usuario;
  console.log("👑 Dashboard SuperAdmin iniciado para usuario:", usuario?.id);
  
  try {
    // ========== ESTADÍSTICAS GLOBALES ==========
    let totalUsuarios = 0;
    let totalReportes = 0;
    let totalReportesActivos = 0;
    let totalCalles = 0;
    let totalComunidades = 0;
    let totalVoluntarios = 0;
    let totalEmpresas = 0;
    let totalCategorias = 0;
    let voluntariosPendientes = 0;
    let voluntariosAprobados = 0;
    let voluntariosRechazados = 0;

    // ========== OBTENER CONFIGURACIÓN DE MOSTRAR BOTÓN ==========
    let mostrarBoton = true;
    try {
      const [configRows] = await db.query('SELECT mostrar_boton FROM configuracion WHERE id = 1');
      mostrarBoton = configRows[0]?.mostrar_boton === 1;
      console.log("✅ Configuración mostrarBoton:", mostrarBoton);
    } catch (err) {
      console.error("❌ Error al obtener mostrar_boton:", err.message);
    }

    try {
      const [usuariosRow] = await db.query('SELECT COUNT(*) as total FROM usuarios');
      totalUsuarios = usuariosRow[0]?.total || 0;
      
      const [reportesRow] = await db.query('SELECT COUNT(*) as total FROM reportes WHERE activo = 1');
      totalReportesActivos = reportesRow[0]?.total || 0;
      
      const [reportesTotalRow] = await db.query('SELECT COUNT(*) as total FROM reportes');
      totalReportes = reportesTotalRow[0]?.total || 0;
      
      const [callesRow] = await db.query('SELECT COUNT(*) as total FROM calles');
      totalCalles = callesRow[0]?.total || 0;
      
      const [comunidadesRow] = await db.query('SELECT COUNT(*) as total FROM comunidades');
      totalComunidades = comunidadesRow[0]?.total || 0;
      
      const [empresasRow] = await db.query('SELECT COUNT(*) as total FROM empresas');
      totalEmpresas = empresasRow[0]?.total || 0;
      
      const [categoriasRow] = await db.query('SELECT COUNT(*) as total FROM categorias');
      totalCategorias = categoriasRow[0]?.total || 0;
      
      // Voluntarios por estado (solo contar APROBADOS como activos)
      const [volAprobadosRow] = await db.query('SELECT COUNT(*) as total FROM voluntarios WHERE estado = "aprobado"');
      voluntariosAprobados = volAprobadosRow[0]?.total || 0;
      
      // Total de voluntarios (todos los estados)
      const [volTotalRow] = await db.query('SELECT COUNT(*) as total FROM voluntarios');
      totalVoluntarios = volTotalRow[0]?.total || 0;
      
      const [volPend] = await db.query('SELECT COUNT(*) as total FROM voluntarios WHERE estado = "pendiente"');
      voluntariosPendientes = volPend[0]?.total || 0;
      
      const [volRech] = await db.query('SELECT COUNT(*) as total FROM voluntarios WHERE estado = "rechazado"');
      voluntariosRechazados = volRech[0]?.total || 0;
      
      console.log("✅ Estadísticas SuperAdmin calculadas");
    } catch (err) {
      console.error("❌ Error en estadísticas SuperAdmin:", err.message);
    }

    // ========== REPORTES POR ESTADO ==========
    let reportesPorEstado = [];
    try {
      const [rows] = await db.query(`
        SELECT estado, COUNT(*) as total
        FROM reportes
        WHERE activo = 1
        GROUP BY estado
      `);
      reportesPorEstado = rows;
    } catch (err) {
      console.error("❌ Error en reportes por estado:", err.message);
    }

    // ========== ÚLTIMOS USUARIOS REGISTRADOS ==========
    let ultimosUsuarios = [];
    try {
      const [rows] = await db.query(`
        SELECT u.id, u.nombre, u.email, r.nombre as rol, u.created_at as fecha_registro
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        ORDER BY u.id DESC
        LIMIT 5
      `);
      ultimosUsuarios = rows;
    } catch (err) {
      console.error("❌ Error en últimos usuarios:", err.message);
    }

    // ========== ÚLTIMOS VOLUNTARIOS REGISTRADOS ==========
    let ultimosVoluntarios = [];
    try {
      const [rows] = await db.query(`
        SELECT v.id, u.nombre as nombre, v.habilidad, v.estado, v.created_at as fecha_solicitud
        FROM voluntarios v
        INNER JOIN usuarios u ON v.usuario_id = u.id
        ORDER BY v.id DESC
        LIMIT 5
      `);
      ultimosVoluntarios = rows;
    } catch (err) {
      console.error("❌ Error en últimos voluntarios:", err.message);
    }

    // ========== ÚLTIMAS ACCIONES DE AUDITORÍA ==========
    let ultimasAuditorias = [];
    try {
      const [rows] = await db.query(`
        SELECT a.*, u.nombre as usuario_nombre
        FROM auditoria a
        LEFT JOIN usuarios u ON a.usuario_id = u.id
        ORDER BY a.fecha DESC
        LIMIT 5
      `);
      ultimasAuditorias = rows;
    } catch (err) {
      console.error("❌ Error en auditorías:", err.message);
    }

    // ========== VOLUNTARIOS POR HABILIDAD (para gráfico) ==========
    let voluntariosPorHabilidad = [];
    try {
      const [rows] = await db.query(`
        SELECT habilidad, COUNT(*) as total
        FROM voluntarios
        WHERE habilidad IS NOT NULL AND habilidad != '' AND estado = 'aprobado'
        GROUP BY habilidad
        ORDER BY total DESC
        LIMIT 5
      `);
      voluntariosPorHabilidad = rows;
    } catch (err) {
      console.error("❌ Error en voluntarios por habilidad:", err.message);
    }

    // ========== ACTIVIDAD RECIENTE (reportes hoy) ==========
    let reportesHoy = 0;
    try {
      const [rows] = await db.query(`
        SELECT COUNT(*) as total FROM reportes 
        WHERE DATE(fecha) = CURDATE() AND activo = 1
      `);
      reportesHoy = rows[0]?.total || 0;
    } catch (err) {
      console.error("❌ Error en reportes hoy:", err.message);
    }

    // ========== USUARIOS ACTIVOS (logueados hoy - aproximado) ==========
    let usuariosActivosHoy = 0;
    try {
      const [rows] = await db.query(`
        SELECT COUNT(DISTINCT usuario_id) as total 
        FROM auditoria 
        WHERE DATE(fecha) = CURDATE()
      `);
      usuariosActivosHoy = rows[0]?.total || 0;
    } catch (err) {
      console.error("❌ Error en usuarios activos:", err.message);
    }

    res.render('dashboards/superadmin', { 
      usuario,
      session: req.session,
      mostrarBoton: mostrarBoton,
      totales: {
        usuarios: totalUsuarios,
        reportes: totalReportes,
        reportesActivos: totalReportesActivos,
        calles: totalCalles,
        comunidades: totalComunidades,
        voluntarios: totalVoluntarios,
        voluntariosActivos: voluntariosAprobados,
        voluntariosPendientes: voluntariosPendientes,
        voluntariosAprobados: voluntariosAprobados,
        voluntariosRechazados: voluntariosRechazados,
        empresas: totalEmpresas,
        categorias: totalCategorias,
        reportesHoy: reportesHoy,
        usuariosActivosHoy: usuariosActivosHoy
      },
      reportesPorEstado,
      ultimosUsuarios,
      ultimosVoluntarios,
      ultimasAuditorias,
      voluntariosPorHabilidad
    });
    
  } catch (err) {
    console.error("❌ Error FATAL en SuperAdmin:", err);
    res.status(500).send("Error al cargar el dashboard SuperAdmin: " + err.message);
  }
};