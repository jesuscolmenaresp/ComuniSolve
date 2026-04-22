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
// 📌 DASHBOARD LÍDER (simplificado)
// ==========================
exports.lider = async (req, res) => {
  const usuario = req.session.usuario;
  console.log("📊 Dashboard Líder iniciado para usuario:", usuario?.id);
  
  try {
    // Obtener calles que lidera
    let misCalles = [];
    try {
      const [rows] = await db.query(`
        SELECT id, nombre FROM calles WHERE lider_id = ?
      `, [usuario.id]);
      misCalles = rows;
      console.log("✅ Calles lideradas:", misCalles.length);
    } catch (err) {
      console.error("❌ Error obteniendo calles:", err.message);
    }
    
    const idsCalles = misCalles.map(c => c.id);
    
    if (idsCalles.length === 0) {
      return res.render('dashboards/lider', { 
        usuario,
        misCalles: [],
        porCategoria: [],
        porEstado: [],
        reportesRecientes: [],
        totales: { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 }
      });
    }

    // Reportes por categoría
    let porCategoria = [];
    try {
      const placeholders = idsCalles.map(() => '?').join(',');
      const [rows] = await db.query(`
        SELECT cat.nombre, COUNT(*) as total
        FROM reportes r
        INNER JOIN categorias cat ON r.categoria_id = cat.id
        WHERE r.calle_id IN (${placeholders})
        GROUP BY cat.id, cat.nombre
      `, idsCalles);
      porCategoria = rows;
    } catch (err) {
      console.error("❌ Error en categorías líder:", err.message);
    }

    // Reportes por estado
    let porEstado = [];
    try {
      const placeholders = idsCalles.map(() => '?').join(',');
      const [rows] = await db.query(`
        SELECT estado, COUNT(*) as total
        FROM reportes
        WHERE calle_id IN (${placeholders})
        GROUP BY estado
      `, idsCalles);
      porEstado = rows;
    } catch (err) {
      console.error("❌ Error en estados líder:", err.message);
    }

    // Reportes recientes
    let reportesRecientes = [];
    try {
      const placeholders = idsCalles.map(() => '?').join(',');
      const [rows] = await db.query(`
        SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
               c.nombre as calle
        FROM reportes r
        INNER JOIN calles c ON r.calle_id = c.id
        WHERE r.calle_id IN (${placeholders})
        ORDER BY r.fecha DESC
        LIMIT 5
      `, idsCalles);
      reportesRecientes = rows;
    } catch (err) {
      console.error("❌ Error en reportes recientes líder:", err.message);
    }

    // Totales
    let totales = { total_reportes: 0, pendientes: 0, en_progreso: 0, resueltos: 0 };
    try {
      const placeholders = idsCalles.map(() => '?').join(',');
      const [totalRow] = await db.query(`
        SELECT COUNT(*) as total FROM reportes WHERE calle_id IN (${placeholders})
      `, idsCalles);
      totales.total_reportes = totalRow[0]?.total || 0;
      
      const [pendRow] = await db.query(`
        SELECT COUNT(*) as total FROM reportes WHERE calle_id IN (${placeholders}) AND estado = 'Pendiente'
      `, idsCalles);
      totales.pendientes = pendRow[0]?.total || 0;
      
      const [progRow] = await db.query(`
        SELECT COUNT(*) as total FROM reportes WHERE calle_id IN (${placeholders}) AND estado = 'En Progreso'
      `, idsCalles);
      totales.en_progreso = progRow[0]?.total || 0;
      
      const [resRow] = await db.query(`
        SELECT COUNT(*) as total FROM reportes WHERE calle_id IN (${placeholders}) AND estado = 'Resuelto'
      `, idsCalles);
      totales.resueltos = resRow[0]?.total || 0;
    } catch (err) {
      console.error("❌ Error en totales líder:", err.message);
    }

    res.render('dashboards/lider', { 
      usuario,
      misCalles,
      porCategoria,
      porEstado,
      reportesRecientes,
      totales
    });
    
  } catch (err) {
    console.error("❌ Error FATAL en líder:", err);
    res.status(500).send("Error al cargar el dashboard: " + err.message);
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