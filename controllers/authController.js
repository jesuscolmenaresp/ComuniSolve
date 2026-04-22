const db = require('../models/db');
const bcrypt = require('bcryptjs');

// Mostrar formulario de login
exports.mostrarLogin = (req, res) => {
  const registroExitoso = req.query.registro === 'exitoso';
  res.render('login', { 
    error: null,
    registroExitoso: registroExitoso
  });
};

// Login
exports.login = async (req, res) => {
  console.log('🔍 Login attempt:', req.body);

  const { email, password } = req.body;

  // Validar que los campos no estén vacíos
  if (!email || !password) {
    return res.render('login', { 
      error: 'Por favor complete todos los campos',
      registroExitoso: false
    });
  }

  try {
    const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (usuarios.length === 0) {
      return res.render('login', { 
        error: 'Usuario no encontrado',
        registroExitoso: false
      });
    }

    const usuario = usuarios[0];
    const validPassword = await bcrypt.compare(password, usuario.password);

    if (!validPassword) {
      return res.render('login', { 
        error: 'Contraseña incorrecta',
        registroExitoso: false
      });
    }

    // Obtener el nombre de la calle si tiene una asignada
    let calle_nombre = null;
    if (usuario.calle_id) {
      const [calle] = await db.query('SELECT nombre FROM calles WHERE id = ?', [usuario.calle_id]);
      calle_nombre = calle[0]?.nombre || null;
    }

    // Guardar sesión (sin rol_nombre porque no existe en la tabla)
    req.session.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol_id: usuario.rol_id,
      calle_id: usuario.calle_id,
      calle_nombre: calle_nombre
    };
    // Guardar sesión explícitamente
    req.session.save((err) => {
      if (err) {
        console.error('❌ Error al guardar sesión:', err);
      } else {
        console.log('✅ Sesión guardada correctamente');
      }
      
      // Redirigir según el rol
      switch (usuario.rol_id) {
        case 1: return res.redirect('/admin');
        case 2: return res.redirect('/lider');
        case 3: return res.redirect('/jefe');
        default: return res.redirect('/');
      }
    });

    console.log('✅ Sesión guardada:', {
      id: usuario.id,
      nombre: usuario.nombre,
      rol_id: usuario.rol_id,
      calle_id: usuario.calle_id,
      calle_nombre: calle_nombre
    });

    // Redirigir según el rol
    switch (usuario.rol_id) {
      case 1: 
        console.log('Redirigiendo a /admin');
        return res.redirect('/admin');
      case 2: 
        console.log('Redirigiendo a /lider');
        return res.redirect('/lider');
      case 3: 
        console.log('Redirigiendo a /jefe');
        return res.redirect('/jefe');
      default: 
        console.log('Redirigiendo a /');
        return res.redirect('/');
    }

  } catch (err) {
    console.error('❌ Error en login:', err);
    res.render('login', { 
      error: 'Error al iniciar sesión. Intente nuevamente.',
      registroExitoso: false
    });
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

  console.log('📝 Registro intentado:', { nombre, email, telefono, calle_id });

  try {
    // Verificar si el email ya existe
    const [existente] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existente.length > 0) {
      const [calles] = await db.query("SELECT * FROM calles ORDER BY nombre");
      return res.render('registro', { 
        error: 'El email ya está registrado', 
        calles 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Contraseña hasheada correctamente');

    await db.query(
      'INSERT INTO usuarios (nombre, email, password, telefono, rol_id, calle_id) VALUES (?, ?, ?, ?, 4, ?)', 
      [nombre, email, hashedPassword, telefono, calle_id || null]
    );

    console.log('✅ Usuario registrado exitosamente');
    res.redirect('/login?registro=exitoso');
  } catch (err) {
    console.error('❌ Error en registro:', err);
    const [calles] = await db.query("SELECT * FROM calles ORDER BY nombre");
    res.render('registro', { error: 'Error al registrar usuario', calles });
  }
};