const db = require('../models/db');

// ==========================
// 📌 DASHBOARD ADMIN (UBCH) CON ESTADÍSTICAS
// ==========================
exports.admin = async (req, res) => {
  console.log("📊 Dashboard Admin iniciado");
  
  try {
    // 1. Reportes por categoría
    let porCategoria = [];
    try {
      const [rows] = await db.query(`
        SELECT cat.nombre, COUNT(*) as total
        FROM reportes r
        INNER JOIN categorias cat ON r.categoria_id = cat.id
        GROUP BY cat.id, cat.nombre
      `);
      porCategoria = rows;
      console.log("✅ Categorías:", porCategoria.length);
    } catch (err) {
      console.error("❌ Error en categorías:", err.message);
    }

    // 2. Reportes por estado
    let porEstado = [];
    try {
      const [rows] = await db.query(`
        SELECT estado, COUNT(*) as total
        FROM reportes
        GROUP BY estado
      `);
      porEstado = rows;
      console.log("✅ Estados:", porEstado.length);
    } catch (err) {
      console.error("❌ Error en estados:", err.message);
    }

    // 3. Reportes por calle (top 5)
    let porCalle = [];
    try {
      const [rows] = await db.query(`
        SELECT c.nombre, COUNT(r.id) as total
        FROM reportes r
        INNER JOIN calles c ON r.calle_id = c.id
        GROUP BY c.id, c.nombre
        ORDER BY total DESC
        LIMIT 5
      `);
      porCalle = rows;
      console.log("✅ Calles:", porCalle.length);
    } catch (err) {
      console.error("❌ Error en calles:", err.message);
    }

    // 4. Totales generales
    let totales = {
      total_reportes: 0,
      pendientes: 0,
      en_progreso: 0,
      resueltos: 0,
      total_ciudadanos: 0,
      total_voluntarios: 0
    };
    
    try {
      const [rows] = await db.query(`
        SELECT COUNT(*) as total FROM reportes
      `);
      totales.total_reportes = rows[0]?.total || 0;
      
      const [pend] = await db.query(`SELECT COUNT(*) as total FROM reportes WHERE estado = 'Pendiente'`);
      totales.pendientes = pend[0]?.total || 0;
      
      const [prog] = await db.query(`SELECT COUNT(*) as total FROM reportes WHERE estado = 'En Progreso'`);
      totales.en_progreso = prog[0]?.total || 0;
      
      const [res] = await db.query(`SELECT COUNT(*) as total FROM reportes WHERE estado = 'Resuelto'`);
      totales.resueltos = res[0]?.total || 0;
      
      const [ciu] = await db.query(`SELECT COUNT(*) as total FROM usuarios WHERE rol_id = 4`);
      totales.total_ciudadanos = ciu[0]?.total || 0;
      
      const [vol] = await db.query(`SELECT COUNT(*) as total FROM voluntarios`);
      totales.total_voluntarios = vol[0]?.total || 0;
      
      console.log("✅ Totales calculados");
    } catch (err) {
      console.error("❌ Error en totales:", err.message);
    }

    // 5. Reportes más votados (simplificado)
    let masVotados = [];
    try {
      const [rows] = await db.query(`
        SELECT r.id, r.titulo, COUNT(v.id) as votos
        FROM reportes r
        LEFT JOIN votos v ON r.id = v.reporte_id
        GROUP BY r.id, r.titulo
        ORDER BY votos DESC
        LIMIT 5
      `);
      masVotados = rows;
      console.log("✅ Más votados:", masVotados.length);
    } catch (err) {
      console.error("❌ Error en votados:", err.message);
    }

    console.log("📊 Renderizando admin");
    res.render('dashboards/admin', { 
      usuario: req.session.usuario,
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
// 📌 DASHBOARD LÍDER (mejorado con gráficos y más datos)
// ==========================
exports.lider = async (req, res) => {
  const usuario = req.session.usuario;
  const { fecha_desde, fecha_hasta } = req.query;
  
  try {
    // 1. Obtener las calles que lidera
    const [misCalles] = await db.query(`
      SELECT id, nombre 
      FROM calles 
      WHERE lider_id = ?
      ORDER BY nombre
    `, [usuario.id]);
    
    const idsCalles = misCalles.map(c => c.id);
    const nombresCalles = misCalles.map(c => c.nombre);
    
    if (idsCalles.length === 0) {
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

    // Construir filtro de fechas
    let fechaFilter = '';
    let fechaParams = [];
    if (fecha_desde && fecha_hasta) {
      fechaFilter = ' AND DATE(r.fecha) BETWEEN ? AND ?';
      fechaParams = [fecha_desde, fecha_hasta];
    } else if (fecha_desde) {
      fechaFilter = ' AND DATE(r.fecha) >= ?';
      fechaParams = [fecha_desde];
    } else if (fecha_hasta) {
      fechaFilter = ' AND DATE(r.fecha) <= ?';
      fechaParams = [fecha_hasta];
    }

    // 2. Reportes por categoría en sus calles (para gráfico)
    const [porCategoria] = await db.query(`
      SELECT cat.nombre, cat.color, COUNT(*) as total
      FROM reportes r
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE r.calle_id IN (?)
      ${fechaFilter}
      GROUP BY cat.id, cat.nombre, cat.color
      ORDER BY total DESC
    `, [idsCalles, ...fechaParams]);

    // 3. Reportes por estado en sus calles (para gráfico)
    const [porEstado] = await db.query(`
      SELECT estado, COUNT(*) as total
      FROM reportes
      WHERE calle_id IN (?)
      ${fechaFilter}
      GROUP BY estado
    `, [idsCalles, ...fechaParams]);

    // 4. Top 5 calles con más reportes
    const [topCalles] = await db.query(`
      SELECT c.nombre, COUNT(r.id) as total
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      WHERE r.calle_id IN (?)
      ${fechaFilter}
      GROUP BY c.id, c.nombre
      ORDER BY total DESC
      LIMIT 5
    `, [idsCalles, ...fechaParams]);

    // 5. Voluntarios aprobados en sus calles
    const [voluntarios] = await db.query(`
      SELECT DISTINCT v.nombre, v.habilidad, v.telefono
      FROM voluntarios v
      INNER JOIN usuarios u ON v.usuario_id = u.id
      WHERE u.calle_id IN (?) AND v.estado = 'aprobado'
      LIMIT 5
    `, [idsCalles]);

    // 6. Reportes recientes en sus calles (últimos 5)
    const [reportesRecientes] = await db.query(`
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
             c.nombre as calle,
             cat.nombre as categoria,
             u.nombre as reportado_por
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.calle_id IN (?)
      ORDER BY r.fecha DESC
      LIMIT 5
    `, [idsCalles]);

    // 7. Totales generales en sus calles
    const [totales] = await db.query(`
      SELECT 
        COUNT(*) as total_reportes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado = 'En Progreso' THEN 1 ELSE 0 END) as en_progreso,
        SUM(CASE WHEN estado = 'Resuelto' THEN 1 ELSE 0 END) as resueltos
      FROM reportes
      WHERE calle_id IN (?)
      ${fechaFilter}
    `, [idsCalles, ...fechaParams]);

    res.render('dashboards/lider', { 
      usuario,
      misCalles,
      nombresCalles: JSON.stringify(nombresCalles),
      porCategoria,
      porEstado,
      topCalles,
      voluntarios,
      reportesRecientes,
      totales: totales[0] || { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 },
      fecha_desde,
      fecha_hasta,
      session: req.session
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar el dashboard de líder");
  }
};

// ==========================
// 📌 DASHBOARD JEFE DE CALLE (simplificado)
// ==========================
exports.jefe = async (req, res) => {
  const usuario = req.session.usuario;
  console.log("📊 Dashboard Jefe iniciado para usuario:", usuario?.id, "calle_id:", usuario?.calle_id);
  
  try {
    if (!usuario.calle_id) {
      return res.render('dashboards/jefe', { 
        usuario,
        tieneCalle: false,
        miCalle: null,
        porCategoria: [],
        porEstado: [],
        reportesRecientes: [],
        totales: { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 }
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

    // Reportes por categoría
    let porCategoria = [];
    try {
      const [rows] = await db.query(`
        SELECT cat.nombre, COUNT(*) as total
        FROM reportes r
        INNER JOIN categorias cat ON r.categoria_id = cat.id
        WHERE r.calle_id = ?
        GROUP BY cat.id, cat.nombre
      `, [usuario.calle_id]);
      porCategoria = rows;
    } catch (err) {
      console.error("❌ Error en categorías jefe:", err.message);
    }

    // Reportes por estado
    let porEstado = [];
    try {
      const [rows] = await db.query(`
        SELECT estado, COUNT(*) as total
        FROM reportes
        WHERE calle_id = ?
        GROUP BY estado
      `, [usuario.calle_id]);
      porEstado = rows;
    } catch (err) {
      console.error("❌ Error en estados jefe:", err.message);
    }

    // Reportes recientes
    let reportesRecientes = [];
    try {
      const [rows] = await db.query(`
        SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado
        FROM reportes r
        WHERE r.calle_id = ?
        ORDER BY r.fecha DESC
        LIMIT 5
      `, [usuario.calle_id]);
      reportesRecientes = rows;
    } catch (err) {
      console.error("❌ Error en reportes recientes jefe:", err.message);
    }

    // Totales
    let totales = { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 };
    try {
      const [totalRow] = await db.query(`SELECT COUNT(*) as total FROM reportes WHERE calle_id = ?`, [usuario.calle_id]);
      totales.total_reportes = totalRow[0]?.total || 0;
      
      const [pendRow] = await db.query(`SELECT COUNT(*) as total FROM reportes WHERE calle_id = ? AND estado = 'Pendiente'`, [usuario.calle_id]);
      totales.pendientes = pendRow[0]?.total || 0;
      
      const [progRow] = await db.query(`SELECT COUNT(*) as total FROM reportes WHERE calle_id = ? AND estado = 'En Progreso'`, [usuario.calle_id]);
      totales.en_progreso = progRow[0]?.total || 0;
      
      const [resRow] = await db.query(`SELECT COUNT(*) as total FROM reportes WHERE calle_id = ? AND estado = 'Resuelto'`, [usuario.calle_id]);
      totales.resueltos = resRow[0]?.total || 0;
    } catch (err) {
      console.error("❌ Error en totales jefe:", err.message);
    }

    res.render('dashboards/jefe', { 
      usuario,
      tieneCalle: true,
      miCalle,
      porCategoria,
      porEstado,
      reportesRecientes,
      totales
    });
    
  } catch (err) {
    console.error("❌ Error FATAL en jefe:", err);
    res.status(500).send("Error al cargar el dashboard: " + err.message);
  }
};