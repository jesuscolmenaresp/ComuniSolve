const db = require('../models/db');

// 📌 Listar calles
exports.listarCalles = async (req, res) => {
  try {
    const [calles] = await db.query(`
      SELECT c.*, u.nombre AS jefe
      FROM calles c
      LEFT JOIN usuarios u ON c.jefe_id = u.id
      ORDER BY c.nombre ASC
    `);
    res.render("calles/listar", { calles });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al listar calles");
  }
};

// 📌 Mostrar formulario de nueva calle
exports.formCrear = async (req, res) => {
  try {
    // traer todos los usuarios con rol 3 (jefes de calle)
    const [jefes] = await db.query("SELECT id, nombre FROM usuarios WHERE rol_id = 3");
    res.render("calles/crear", { jefes });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error cargando formulario");
  }
};

// 📌 Guardar nueva calle
exports.crear = async (req, res) => {
  const { nombre, jefe_id } = req.body;
  try {
    await db.query("INSERT INTO calles (nombre, jefe_id) VALUES (?, ?)", [nombre, jefe_id || null]);
    res.redirect("/calles");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al crear calle");
  }
};
