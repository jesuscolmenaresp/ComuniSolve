const db = require('../models/db');
const bcrypt = require('bcryptjs');
const { enviarNotificacionNuevoUsuario } = require('../services/emailService');

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

    // ✅ VERIFICAR ESTADO DEL USUARIO
    if (usuario.estado !== 'aprobado') {
      let mensaje = 'Tu cuenta está pendiente de aprobación. Recibirás un correo cuando sea aprobada.';
      if (usuario.estado === 'rechazado') {
        mensaje = 'Tu cuenta ha sido rechazada. Contacta al administrador.';
      }
      return res.render('login', { 
        error: mensaje,
        registroExitoso: false
      });
    }

    // Obtener el nombre de la calle
    let calle_nombre = null;
    if (usuario.calle_id) {
      const [calle] = await db.query('SELECT nombre FROM calles WHERE id = ?', [usuario.calle_id]);
      calle_nombre = calle[0]?.nombre || null;
    }

    // Guardar sesión
    req.session.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol_id: usuario.rol_id,
      calle_id: usuario.calle_id,
      calle_nombre: calle_nombre
    };

    console.log('✅ Sesión guardada:', {
      id: usuario.id,
      nombre: usuario.nombre,
      rol_id: usuario.rol_id,
      calle_id: usuario.calle_id,
      calle_nombre: calle_nombre
    });

    // Determinar redirección según rol
    let redirectUrl = '/';
    switch (usuario.rol_id) {
      case 1: redirectUrl = '/admin'; break;
      case 2: redirectUrl = '/lider'; break;
      case 3: redirectUrl = '/jefe'; break;
      default: redirectUrl = '/';
    }

    // Guardar sesión y redirigir UNA SOLA VEZ
    req.session.save((err) => {
      if (err) {
        console.error('❌ Error al guardar sesión:', err);
        return res.render('login', { 
          error: 'Error al iniciar sesión',
          registroExitoso: false
        });
      }
      console.log('✅ Sesión guardada correctamente, redirigiendo a', redirectUrl);
      return res.redirect(redirectUrl);
    });

  } catch (err) {
    console.error('❌ Error en login:', err);
    return res.render('login', { 
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

// Registro de ciudadano (con cédula, confirmación y estado pendiente)
exports.registrar = async (req, res) => {
  const { cedula, nombre, email, password, confirm_password, telefono, calle_id } = req.body;

  // Validar que las contraseñas coincidan
  if (password !== confirm_password) {
    const [calles] = await db.query("SELECT * FROM calles ORDER BY nombre");
    return res.render('registro', { 
      error: 'Las contraseñas no coinciden', 
      calles 
    });
  }

  // Validar longitud de contraseña
  if (password.length < 6) {
    const [calles] = await db.query("SELECT * FROM calles ORDER BY nombre");
    return res.render('registro', { 
      error: 'La contraseña debe tener al menos 6 caracteres', 
      calles 
    });
  }

  // Validar cédula (solo números)
  if (!cedula || !/^\d+$/.test(cedula)) {
    const [calles] = await db.query("SELECT * FROM calles ORDER BY nombre");
    return res.render('registro', { 
      error: 'La cédula debe contener solo números', 
      calles 
    });
  }

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

    // Verificar si la cédula ya existe
    const [cedulaExistente] = await db.query('SELECT id FROM usuarios WHERE cedula = ?', [cedula]);
    if (cedulaExistente.length > 0) {
      const [calles] = await db.query("SELECT * FROM calles ORDER BY nombre");
      return res.render('registro', { 
        error: 'La cédula ya está registrada', 
        calles 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertar usuario con estado 'pendiente'
    const [result] = await db.query(
      'INSERT INTO usuarios (cedula, nombre, email, password, telefono, rol_id, calle_id, estado, fecha_registro) VALUES (?, ?, ?, ?, ?, 4, ?, "pendiente", NOW())', 
      [cedula, nombre, email, hashedPassword, telefono, calle_id || null]
    );

    // Obtener la calle para saber quiénes deben ser notificados
    const [calleInfo] = await db.query(`
      SELECT c.nombre, l.email as lider_email, l.nombre as lider_nombre,
             u.email as ubch_email, u.nombre as ubch_nombre
      FROM calles c
      LEFT JOIN usuarios l ON c.lider_id = l.id
      LEFT JOIN usuarios u ON u.rol_id = 1
      WHERE c.id = ?
    `, [calle_id]);

    // Notificar al líder de la calle
    if (calleInfo[0]?.lider_email) {
      await enviarNotificacionNuevoUsuario(
        { email: calleInfo[0].lider_email, nombre: calleInfo[0].lider_nombre },
        { cedula, nombre, email, telefono, calle: calleInfo[0].nombre }
      );
    }

    // Notificar a UBCH
    if (calleInfo[0]?.ubch_email) {
      await enviarNotificacionNuevoUsuario(
        { email: calleInfo[0].ubch_email, nombre: calleInfo[0].ubch_nombre || 'UBCH' },
        { cedula, nombre, email, telefono, calle: calleInfo[0].nombre }
      );
    }

    res.redirect('/login?registro=exitoso');
  } catch (err) {
    console.error(err);
    const [calles] = await db.query("SELECT * FROM calles ORDER BY nombre");
    res.render('registro', { error: 'Error al registrar usuario', calles });
  }
};