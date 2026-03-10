// controllers/reporteController.js
const db = require('../models/db');

/*
  📌 Controlador de reportes
  Exporta:
   - listarReportes   -> GET /reportes
   - mostrarFormulario-> GET /reportar
   - guardarReporte   -> POST /reportar
   - cambiarEstado    -> POST /reportes/:id/estado
   - asignarEmpresa   -> POST /reportes/:id/asignar-empresa
*/

// ==========================
// 📌 LISTAR REPORTES (con empresas)
// ==========================
exports.listarReportes = async (req, res) => {
  const usuario = req.session.usuario;

  try {
    let query = `
      SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
             r.mostrar_nombre, r.imagen,
             u.nombre AS nombre_usuario,
             j.nombre AS nombre_jefe,
             c.nombre AS nombre_calle,
             cat.id AS categoria_id,
             cat.nombre AS categoria_nombre,
             cat.icono AS categoria_icono,
             cat.color AS categoria_color,
             e.id AS empresa_id,
             e.nombre AS empresa_nombre,
             e.contacto AS empresa_contacto,
             (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS total_votos
      FROM reportes r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      LEFT JOIN usuarios j ON r.jefe_calle_id = j.id
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      LEFT JOIN empresas e ON r.empresa_id = e.id
    `;
    
    let params = [];

    if (!usuario) {
      return res.redirect('/login');
    }

    if (usuario.rol_id === 3) { 
      // Jefe de calle: solo reportes de su calle
      query += " WHERE r.calle_id = ?";
      params.push(usuario.calle_id);
    } else if (usuario.rol_id === 2) { 
      // Líder: reportes de calles que lidera
      query += " WHERE r.calle_id IN (SELECT id FROM calles WHERE lider_id = ?)";
      params.push(usuario.id);
    } else if (usuario.rol_id === 4) {
      // Ciudadano: TODOS sus reportes (incluyendo anónimos)
      query += " WHERE r.usuario_id = ?";
      params.push(usuario.id);
    }
    // UBCH (rol 1) ve todos sin filtro

    query += " ORDER BY r.fecha DESC";

    const [reportes] = await db.query(query, params);
    
    // Obtener todas las empresas para el modal de asignación
    const [empresas] = await db.query('SELECT * FROM empresas ORDER BY nombre');
    
    // Obtener votos del usuario actual
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
    
    res.render('reportes', { 
      reportes, 
      empresas,
      usuario,
      votosUsuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener reportes");
  }
};

// ==========================
// 📌 FORMULARIO DE REPORTE (sin empresas)
// ==========================
exports.mostrarFormulario = async (req, res) => {
  try {
    const [calles] = await db.query("SELECT * FROM calles ORDER BY nombre");
    const [categorias] = await db.query("SELECT * FROM categorias ORDER BY nombre");
    
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
// 📌 GUARDAR REPORTE (mejorado para anónimos)
// ==========================
exports.guardarReporte = async (req, res) => {
  const { titulo, descripcion, categoria_id, calle_id, mostrar_nombre, ubicacion_lat, ubicacion_lng } = req.body;
  const usuario = req.session.usuario;
  const imagen = req.file ? "/uploads/reportes/" + req.file.filename : null;

  try {
    // Buscar jefe de la calle (para asignarlo en reportes anónimos)
    const [calle] = await db.query("SELECT jefe_id FROM calles WHERE id = ?", [calle_id]);
    const jefe_id = calle[0]?.jefe_id || null;

    // Guardar SIEMPRE el usuario_id, independientemente de mostrar_nombre
    // Así el ciudadano puede ver sus reportes aunque sean anónimos
    await db.query(
      `INSERT INTO reportes 
        (titulo, descripcion, categoria_id, usuario_id, jefe_calle_id, calle_id, mostrar_nombre, estado, fecha, imagen, ubicacion_lat, ubicacion_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', NOW(), ?, ?, ?)`,
      [
        titulo, 
        descripcion, 
        categoria_id, 
        usuario.id,  // ← SIEMPRE guardamos el ID del usuario
        mostrar_nombre ? null : jefe_id,  // Si es anónimo, asignamos jefe
        calle_id, 
        mostrar_nombre ? 1 : 0, 
        imagen, 
        ubicacion_lat || null, 
        ubicacion_lng || null
      ]
    );

    req.session.mensaje = 'Reporte enviado exitosamente';
    res.redirect("/reportes");
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al enviar el reporte';
    res.redirect("/reportar");
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

    if (![1,2,3].includes(usuario.rol_id)) {
      return res.status(403).send("No autorizado para cambiar estado");
    }

    const [rows] = await db.query("SELECT calle_id FROM reportes WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).send("Reporte no encontrado");
    const reporte = rows[0];

    // Validar permisos según rol
    if (usuario.rol_id === 3) {
      if (reporte.calle_id !== usuario.calle_id) {
        return res.status(403).send("No está autorizado para cambiar el estado de este reporte");
      }
    }

    if (usuario.rol_id === 2) {
      const [check] = await db.query("SELECT id FROM calles WHERE id = ? AND lider_id = ?", [reporte.calle_id, usuario.id]);
      if (check.length === 0) {
        return res.status(403).send("No está autorizado para cambiar el estado de este reporte");
      }
    }

    // Validar que el estado sea válido
    const estadosValidos = ['Pendiente', 'En Progreso', 'Resuelto'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).send("Estado no válido");
    }

    await db.query("UPDATE reportes SET estado = ? WHERE id = ?", [estado, id]);

    req.session.mensaje = 'Estado actualizado correctamente';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al actualizar estado");
  }
};

// ==========================
// 📌 ASIGNAR EMPRESA A REPORTE
// ==========================
exports.asignarEmpresa = async (req, res) => {
  const { id } = req.params;
  const { empresa_id } = req.body;
  const usuario = req.session.usuario;

  try {
    // Solo UBCH (1) y Líder (2) pueden asignar empresas
    if (!usuario || ![1,2].includes(usuario.rol_id)) {
      req.session.error = "No autorizado para asignar empresas";
      return res.redirect('/reportes');
    }

    await db.query(
      'UPDATE reportes SET empresa_id = ? WHERE id = ?',
      [empresa_id || null, id]
    );
    
    req.session.mensaje = 'Empresa asignada correctamente';
    res.redirect('/reportes');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al asignar empresa';
    res.redirect('/reportes');
  }
};