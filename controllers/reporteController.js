// controllers/reporteController.js
const db = require('../models/db');

/*
  📌 Controlador de reportes
  Exporta:
   - listarReportes   -> GET /reportes
   - mostrarFormulario-> GET /reportar
   - guardarReporte   -> POST /reportar
   - cambiarEstado    -> POST /reportes/:id/estado
*/

// ==========================
// 📌 LISTAR REPORTES
// ==========================
exports.listarReportes = async (req, res) => {
  const usuario = req.session.usuario;

  try {
let query = `
  SELECT r.id, r.titulo, r.descripcion, r.categoria, r.fecha, r.estado,
         r.mostrar_nombre, r.imagen,   -- 👈 aquí agregamos la columna
         u.nombre AS nombre_usuario,
         j.nombre AS nombre_jefe,
         c.nombre AS nombre_calle
  FROM reportes r
  LEFT JOIN usuarios u ON r.usuario_id = u.id
  LEFT JOIN usuarios j ON r.jefe_calle_id = j.id
  INNER JOIN calles c ON r.calle_id = c.id
`;
    let params = [];

    // Filtrar según el rol (misma lógica que usábamos en rutas)
    if (!usuario) {
      // por seguridad, si no hay sesión redirigir al login
      return res.redirect('/login');
    }

    if (usuario.rol_id === 3) { 
      // Jefe de calle → solo reportes de su calle
      query += " WHERE r.calle_id = ?";
      params.push(usuario.calle_id);
    } else if (usuario.rol_id === 2) { 
      // Líder → todas las calles que lidera
      query += " WHERE r.calle_id IN (SELECT id FROM calles WHERE lider_id = ?)";
      params.push(usuario.id);
    } else if (usuario.rol_id === 1) { 
      // UBCH → ve todo (sin filtro)
    } else {
      // Ciudadano → solo sus reportes
      query += " WHERE r.usuario_id = ?";
      params.push(usuario.id);
    }

    query += " ORDER BY r.fecha DESC";

    const [reportes] = await db.query(query, params);
    res.render('reportes', { reportes, usuario });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener reportes");
  }
};

// ==========================
// 📌 FORMULARIO DE REPORTE
// ==========================
exports.mostrarFormulario = async (req, res) => {
  try {
    // Cargar calles y jefes para los selects del formulario
    const [calles] = await db.query("SELECT * FROM calles");
    const [jefes] = await db.query("SELECT * FROM usuarios WHERE rol_id = 3");
    res.render("reportar", { calles, jefes });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error cargando formulario");
  }
};

// ==========================
// 📌 GUARDAR REPORTE (con imagen + ubicación)
// ==========================
exports.guardarReporte = async (req, res) => {
  const { titulo, descripcion, categoria, calle_id, mostrar_nombre, ubicacion_lat, ubicacion_lng } = req.body;
  const usuario = req.session.usuario;

  // 📸 si hay archivo adjunto lo guardamos en la BD
  const imagen = req.file ? "/uploads/reportes/" + req.file.filename : null;

  try {
    if (mostrar_nombre) {
      // ✅ Reporte identificado
      await db.query(
        `INSERT INTO reportes 
          (titulo, descripcion, categoria, usuario_id, calle_id, mostrar_nombre, estado, fecha, imagen, ubicacion_lat, ubicacion_lng)
         VALUES (?, ?, ?, ?, ?, 1, 'Pendiente', NOW(), ?, ?, ?)`,
        [titulo, descripcion, categoria, usuario.id, calle_id, imagen, ubicacion_lat || null, ubicacion_lng || null]
      );
    } else {
      // ✅ Reporte anónimo → buscar jefe de la calle automáticamente
      const [calle] = await db.query("SELECT jefe_id FROM calles WHERE id = ?", [calle_id]);
      const jefe_id = calle[0]?.jefe_id || null;

      await db.query(
        `INSERT INTO reportes 
          (titulo, descripcion, categoria, jefe_calle_id, calle_id, mostrar_nombre, estado, fecha, imagen, ubicacion_lat, ubicacion_lng)
         VALUES (?, ?, ?, ?, ?, 0, 'Pendiente', NOW(), ?, ?, ?)`,
        [titulo, descripcion, categoria, jefe_id, calle_id, imagen, ubicacion_lat || null, ubicacion_lng || null]
      );
    }

    res.redirect("/reportes");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al enviar el reporte");
  }
};

// ==========================
// 📌 CAMBIAR ESTADO DE REPORTE
// ==========================
exports.cambiarEstado = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const usuario = req.session.usuario;

  try {
    if (!usuario) return res.status(401).send("No autorizado");

    // Solo roles 1 (UBCH), 2 (Líder) y 3 (Jefe) pueden cambiar estados
    if (![1,2,3].includes(usuario.rol_id)) {
      return res.status(403).send("No autorizado para cambiar estado");
    }

    // Obtener el reporte para validar permisos según rol
    const [rows] = await db.query("SELECT calle_id FROM reportes WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).send("Reporte no encontrado");
    const reporte = rows[0];

    // Si es Jefe de calle (3) -> sólo puede cambiar si el reporte pertenece a su calle
    if (usuario.rol_id === 3) {
      if (reporte.calle_id !== usuario.calle_id) {
        return res.status(403).send("No está autorizado para cambiar el estado de este reporte");
      }
    }

    // Si es Líder (2) -> puede sólo si la calle está bajo su liderazgo
    if (usuario.rol_id === 2) {
      const [check] = await db.query("SELECT id FROM calles WHERE id = ? AND lider_id = ?", [reporte.calle_id, usuario.id]);
      if (check.length === 0) {
        return res.status(403).send("No está autorizado para cambiar el estado de este reporte");
      }
    }

    // UBCH (1) puede cambiar cualquier reporte, sin más comprobaciones

    // Actualizar estado (se espera que 'estado' sea uno de los valores permitidos en la BD)
    await db.query("UPDATE reportes SET estado = ? WHERE id = ?", [estado, id]);

    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al actualizar estado");
  }
};
