const db = require('../models/db');
const bcrypt = require('bcryptjs');

// Mostrar formulario de login
exports.mostrarLogin = (req, res) => {
  res.render('login', { error: null });
};

// Login
exports.login = async (req, res) => {
    console.log(req.body); // 👈 Mira si email y password llegan

  const { email, password } = req.body;

  try {
    const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (usuarios.length === 0) {
      return res.render('login', { error: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];
    const validPassword = await bcrypt.compare(password, usuario.password);

    if (!validPassword) {
      return res.render('login', { error: 'Contraseña incorrecta' });
    }

    // Guardar sesión
    req.session.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol_id: usuario.rol_id
    };

    // Redirigir según el rol
    switch (usuario.rol_id) {
      case 1: return res.redirect('/admin');
      case 2: return res.redirect('/lider');
      case 3: return res.redirect('/jefe');
      default: return res.redirect('/');
    }

  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Error al iniciar sesión' });
  }
};

// Logout
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE REGISTRO
// ==========================
exports.mostrarRegistro = async (req, res) => {
  try {
    const [calles] = await db.query("SELECT id, nombre FROM calles ORDER BY nombre");
    res.render('registro', { 
      calles,
      error: null 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar formulario de registro");
  }
};

// Registro de ciudadano
exports.registrar = async (req, res) => {
  const { nombre, email, password, telefono, calle_id } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO usuarios (nombre, email, password, telefono, rol_id, calle_id) VALUES (?, ?, ?, ?, 4, ?)', 
      [nombre, email, hashedPassword, telefono, calle_id]
    );

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    const [calles] = await db.query("SELECT * FROM calles");
    res.render('registro', { error: 'Error al registrar usuario', calles });
  }
};
