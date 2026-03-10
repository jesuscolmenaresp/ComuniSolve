const db = require('../models/db');

// 📌 Listar calles (con líder y jefe)
// 📌 Listar calles (con comunidad)
exports.listarCalles = async (req, res) => {
  try {
    const [calles] = await db.query(`
      SELECT c.*, 
             u.nombre AS jefe_nombre, 
             l.nombre AS lider_nombre,
             com.nombre AS comunidad_nombre
      FROM calles c
      LEFT JOIN usuarios u ON c.jefe_id = u.id
      LEFT JOIN usuarios l ON c.lider_id = l.id
      LEFT JOIN comunidades com ON c.comunidad_id = com.id
      ORDER BY c.nombre ASC
    `);
    res.render("calles/listar", { 
      calles,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al listar calles");
  }
};

// 📌 Mostrar formulario de nueva calle
exports.formCrear = async (req, res) => {
  try {
    const [jefes] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 3");
    const [lideres] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 2");
    const [comunidades] = await db.query("SELECT id, nombre FROM comunidades ORDER BY nombre");
    
    res.render("calles/crear", { 
      jefes, 
      lideres,
      comunidades,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error cargando formulario");
  }
};

// 📌 Guardar nueva calle (con comunidad)
exports.crear = async (req, res) => {
  const { nombre, jefe_id, lider_id, comunidad_id } = req.body;
  
  try {
    await db.query(
      "INSERT INTO calles (nombre, jefe_id, lider_id, comunidad_id) VALUES (?, ?, ?, ?)",
      [nombre, jefe_id || null, lider_id || null, comunidad_id || null]
    );
    req.session.mensaje = 'Calle creada exitosamente';
    res.redirect("/calles");
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al crear calle';
    res.redirect("/calles/nueva");
  }
};

// 📌 Formulario de edición
exports.formEditar = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [calle] = await db.query("SELECT * FROM calles WHERE id = ?", [id]);
    const [jefes] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 3");
    const [lideres] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 2");
    const [comunidades] = await db.query("SELECT id, nombre FROM comunidades ORDER BY nombre");
    
    if (calle.length === 0) {
      return res.status(404).send("Calle no encontrada");
    }
    
    res.render("calles/editar", { 
      calle: calle[0],
      jefes, 
      lideres,
      comunidades,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar formulario de edición");
  }
};

// 📌 Actualizar calle
exports.actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, jefe_id, lider_id, comunidad_id } = req.body;
  
  try {
    await db.query(
      "UPDATE calles SET nombre = ?, jefe_id = ?, lider_id = ?, comunidad_id = ? WHERE id = ?",
      [nombre, jefe_id || null, lider_id || null, comunidad_id || null, id]
    );
    req.session.mensaje = 'Calle actualizada exitosamente';
    res.redirect("/calles");
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al actualizar calle';
    res.redirect(`/calles/${id}/editar`);
  }
};
