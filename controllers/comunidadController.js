const db = require('../models/db');

// 📌 Listar comunidades
exports.listar = async (req, res) => {
  try {
    const [comunidades] = await db.query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM calles WHERE comunidad_id = c.id) as total_calles
      FROM comunidades c
      ORDER BY c.nombre
    `);
    
    res.render('comunidades/listar', { 
      comunidades,
      usuario: req.session.usuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al listar comunidades');
  }
};

// 📌 Mostrar formulario de nueva comunidad
exports.formCrear = (req, res) => {
  res.render('comunidades/crear', { 
    usuario: req.session.usuario,
    session: req.session
  });
};

// 📌 Guardar nueva comunidad
exports.crear = async (req, res) => {
  const { nombre, descripcion } = req.body;
  
  try {
    await db.query(
      'INSERT INTO comunidades (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion || null]
    );
    req.session.mensaje = 'Comunidad creada exitosamente';
    res.redirect('/comunidades');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al crear comunidad';
    res.redirect('/comunidades/nueva');
  }
};

// 📌 Mostrar formulario de edición
exports.formEditar = async (req, res) => {
  const { id } = req.params;
  
  try {
    const [comunidad] = await db.query('SELECT * FROM comunidades WHERE id = ?', [id]);
    if (comunidad.length === 0) {
      return res.status(404).send('Comunidad no encontrada');
    }
    
    res.render('comunidades/editar', { 
      comunidad: comunidad[0],
      usuario: req.session.usuario,
      session: req.session
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar formulario');
  }
};

// 📌 Actualizar comunidad
exports.actualizar = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  
  try {
    await db.query(
      'UPDATE comunidades SET nombre = ?, descripcion = ? WHERE id = ?',
      [nombre, descripcion || null, id]
    );
    req.session.mensaje = 'Comunidad actualizada exitosamente';
    res.redirect('/comunidades');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al actualizar comunidad';
    res.redirect(`/comunidades/${id}/editar`);
  }
};

// 📌 Eliminar comunidad
exports.eliminar = async (req, res) => {
  const { id } = req.params;
  
  try {
    await db.query('DELETE FROM comunidades WHERE id = ?', [id]);
    req.session.mensaje = 'Comunidad eliminada exitosamente';
    res.redirect('/comunidades');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al eliminar comunidad';
    res.redirect('/comunidades');
  }
};

// 📌 Asignar comunidades a UBCH
exports.asignarUBCH = async (req, res) => {
  const { ubch_id, comunidades } = req.body;
  
  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();
    
    await connection.query('DELETE FROM ubch_comunidades WHERE ubch_id = ?', [ubch_id]);
    
    if (comunidades && comunidades.length > 0) {
      for (const comunidad_id of comunidades) {
        await connection.query(
          'INSERT INTO ubch_comunidades (ubch_id, comunidad_id) VALUES (?, ?)',
          [ubch_id, comunidad_id]
        );
      }
    }
    
    await connection.commit();
    connection.release();
    
    req.session.mensaje = 'Comunidades asignadas exitosamente';
    res.redirect('/usuarios');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error al asignar comunidades';
    res.redirect('/usuarios');
  }
};

// 📌 Obtener comunidades de un UBCH (para edición)
exports.getComunidadesUBCH = async (req, res) => {
  const { ubch_id } = req.params;
  
  try {
    const [comunidades] = await db.query(
      'SELECT comunidad_id FROM ubch_comunidades WHERE ubch_id = ?',
      [ubch_id]
    );
    res.json(comunidades.map(c => c.comunidad_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener comunidades' });
  }
};