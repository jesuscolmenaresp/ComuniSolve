const db = require('../models/db');

// ==========================
// 📌 DASHBOARD ADMIN (UBCH) CON ESTADÍSTICAS
// ==========================
exports.admin = async (req, res) => {
  try {
    // 1. Reportes por categoría (usando categorias.id)
    const [porCategoria] = await db.query(`
      SELECT cat.nombre, cat.icono, cat.color, COUNT(*) as total
      FROM reportes r
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      GROUP BY cat.id, cat.nombre, cat.icono, cat.color
      ORDER BY total DESC
    `);

    // 2. Reportes por estado
    const [porEstado] = await db.query(`
      SELECT estado, COUNT(*) as total
      FROM reportes
      GROUP BY estado
    `);

    // 3. Reportes por calle (top 5)
    const [porCalle] = await db.query(`
      SELECT c.nombre, COUNT(r.id) as total
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      GROUP BY r.calle_id, c.nombre
      ORDER BY total DESC
      LIMIT 5
    `);

    // 4. Reportes más votados (top 5)
    const [masVotados] = await db.query(`
      SELECT r.id, r.titulo, cat.nombre as categoria, 
             COUNT(v.id) as votos,
             c.nombre as calle
      FROM reportes r
      LEFT JOIN votos v ON r.id = v.reporte_id
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      GROUP BY r.id, r.titulo, cat.nombre, c.nombre
      ORDER BY votos DESC
      LIMIT 5
    `);

    // 5. Totales generales
    const [totales] = await db.query(`
      SELECT 
        COUNT(*) as total_reportes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado = 'En Progreso' THEN 1 ELSE 0 END) as en_progreso,
        SUM(CASE WHEN estado = 'Resuelto' THEN 1 ELSE 0 END) as resueltos,
        (SELECT COUNT(*) FROM usuarios WHERE rol_id = 4) as total_ciudadanos,
        (SELECT COUNT(*) FROM voluntarios) as total_voluntarios
      FROM reportes
    `);

    res.render('dashboards/admin', { 
      usuario: req.session.usuario,
      porCategoria,
      porEstado,
      porCalle,
      masVotados,
      totales: totales[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar el dashboard");
  }
};

// ==========================
// 📌 DASHBOARD LÍDER (con estadísticas de sus calles)
// ==========================
exports.lider = async (req, res) => {
  const usuario = req.session.usuario;
  
  try {
    // 1. Obtener las calles que lidera
    const [misCalles] = await db.query(`
      SELECT id, nombre 
      FROM calles 
      WHERE lider_id = ?
    `, [usuario.id]);
    
    const idsCalles = misCalles.map(c => c.id);
    
    if (idsCalles.length === 0) {
      return res.render('dashboards/lider', { 
        usuario,
        misCalles: [],
        porCategoria: [],
        porEstado: [],
        reportesRecientes: [],
        totales: {
          total_reportes: 0,
          pendientes: 0,
          en_progreso: 0,
          resueltos: 0
        }
      });
    }

    // 2. Reportes por categoría en sus calles
    const [porCategoria] = await db.query(`
      SELECT cat.nombre, cat.icono, cat.color, COUNT(*) as total
      FROM reportes r
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE r.calle_id IN (?)
      GROUP BY cat.id, cat.nombre, cat.icono, cat.color
    `, [idsCalles]);

    // 3. Reportes por estado en sus calles
    const [porEstado] = await db.query(`
      SELECT estado, COUNT(*) as total
      FROM reportes
      WHERE calle_id IN (?)
      GROUP BY estado
    `, [idsCalles]);

    // 4. Reportes recientes en sus calles (últimos 5)
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

    // 5. Totales generales en sus calles
    const [totales] = await db.query(`
      SELECT 
        COUNT(*) as total_reportes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado = 'En Progreso' THEN 1 ELSE 0 END) as en_progreso,
        SUM(CASE WHEN estado = 'Resuelto' THEN 1 ELSE 0 END) as resueltos
      FROM reportes
      WHERE calle_id IN (?)
    `, [idsCalles]);

    res.render('dashboards/lider', { 
      usuario,
      misCalles,
      porCategoria,
      porEstado,
      reportesRecientes,
      totales: totales[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar el dashboard de líder");
  }
};

// ==========================
// 📌 DASHBOARD JEFE DE CALLE (con estadísticas de su calle)
// ==========================
exports.jefe = async (req, res) => {
  const usuario = req.session.usuario;
  
  try {
    if (!usuario.calle_id) {
      return res.render('dashboards/jefe', { 
        usuario,
        tieneCalle: false,
        miCalle: null,
        porCategoria: [],
        porEstado: [],
        reportesRecientes: [],
        totales: {
          total_reportes: 0,
          pendientes: 0,
          en_progreso: 0,
          resueltos: 0
        }
      });
    }

    const [calleInfo] = await db.query(`
      SELECT nombre 
      FROM calles 
      WHERE id = ?
    `, [usuario.calle_id]);
    
    const miCalle = calleInfo[0];

    // 1. Reportes por categoría en su calle
    const [porCategoria] = await db.query(`
      SELECT cat.nombre, cat.icono, cat.color, COUNT(*) as total
      FROM reportes r
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      WHERE r.calle_id = ?
      GROUP BY cat.id, cat.nombre, cat.icono, cat.color
    `, [usuario.calle_id]);

    // 2. Reportes por estado en su calle
    const [porEstado] = await db.query(`
      SELECT estado, COUNT(*) as total
      FROM reportes
      WHERE calle_id = ?
      GROUP BY estado
    `, [usuario.calle_id]);

    // 3. Reportes recientes en su calle (últimos 5)
    const [reportesRecientes] = await db.query(`
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
             cat.nombre as categoria,
             CASE 
               WHEN r.mostrar_nombre = 1 AND u.nombre IS NOT NULL THEN u.nombre
               ELSE 'Anónimo'
             END as reportado_por
      FROM reportes r
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.calle_id = ?
      ORDER BY r.fecha DESC
      LIMIT 5
    `, [usuario.calle_id]);

    // 4. Totales generales en su calle
    const [totales] = await db.query(`
      SELECT 
        COUNT(*) as total_reportes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
        SUM(CASE WHEN estado = 'En Progreso' THEN 1 ELSE 0 END) as en_progreso,
        SUM(CASE WHEN estado = 'Resuelto' THEN 1 ELSE 0 END) as resueltos
      FROM reportes
      WHERE calle_id = ?
    `, [usuario.calle_id]);

    res.render('dashboards/jefe', { 
      usuario,
      tieneCalle: true,
      miCalle: miCalle.nombre,
      porCategoria,
      porEstado,
      reportesRecientes,
      totales: totales[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar el dashboard de jefe de calle");
  }
};