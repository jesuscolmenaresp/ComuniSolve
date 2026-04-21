const db = require('../models/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { enviarCorreoRecuperacion } = require('../services/emailService');

// Mostrar formulario de "Olvidé mi contraseña"
exports.mostrarOlvidePassword = (req, res) => {
  res.render('auth/olvide-password', { 
    error: null, 
    mensaje: null,
    session: req.session 
  });
};

// Procesar solicitud de recuperación
exports.solicitarRecuperacion = async (req, res) => {
  const { email } = req.body;

  try {
    // Verificar si el email existe
    const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    
    if (usuarios.length === 0) {
      return res.render('auth/olvide-password', { 
        error: 'No existe una cuenta con este correo electrónico',
        mensaje: null,
        session: req.session 
      });
    }

    const usuario = usuarios[0];

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expira en 1 hora

    // Guardar token en la base de datos
    await db.query(
      'INSERT INTO password_resets (usuario_id, token, expires_at) VALUES (?, ?, ?)',
      [usuario.id, token, expiresAt]
    );

    // Enviar correo
    await enviarCorreoRecuperacion(usuario, token);

    res.render('auth/olvide-password', { 
      error: null,
      mensaje: 'Se ha enviado un correo con las instrucciones para restablecer tu contraseña.',
      session: req.session 
    });

  } catch (err) {
    console.error(err);
    res.render('auth/olvide-password', { 
      error: 'Error al procesar la solicitud. Intente nuevamente.',
      mensaje: null,
      session: req.session 
    });
  }
};

// Mostrar formulario para nueva contraseña
exports.mostrarResetPassword = async (req, res) => {
  const { token } = req.params;

  try {
    // Verificar si el token es válido y no ha expirado
    const [tokens] = await db.query(
      'SELECT * FROM password_resets WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token]
    );

    if (tokens.length === 0) {
      return res.render('auth/reset-password', { 
        error: 'El enlace ha expirado o ya ha sido utilizado.',
        token: null,
        session: req.session 
      });
    }

    res.render('auth/reset-password', { 
      error: null,
      token: token,
      session: req.session 
    });

  } catch (err) {
    console.error(err);
    res.render('auth/reset-password', { 
      error: 'Error al verificar el enlace.',
      token: null,
      session: req.session 
    });
  }
};

// Procesar cambio de contraseña
exports.procesarResetPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirm_password } = req.body;

  // Validar que las contraseñas coincidan
  if (password !== confirm_password) {
    return res.render('auth/reset-password', { 
      error: 'Las contraseñas no coinciden.',
      token: token,
      session: req.session 
    });
  }

  // Validar longitud mínima
  if (password.length < 6) {
    return res.render('auth/reset-password', { 
      error: 'La contraseña debe tener al menos 6 caracteres.',
      token: token,
      session: req.session 
    });
  }

  try {
    // Verificar token
    const [tokens] = await db.query(
      'SELECT * FROM password_resets WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token]
    );

    if (tokens.length === 0) {
      return res.render('auth/reset-password', { 
        error: 'El enlace ha expirado o ya ha sido utilizado.',
        token: null,
        session: req.session 
      });
    }

    const resetRecord = tokens[0];

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(password, salt);

    // Actualizar contraseña del usuario
    await db.query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [newPasswordHash, resetRecord.usuario_id]
    );

    // Marcar token como usado
    await db.query(
      'UPDATE password_resets SET used = TRUE WHERE id = ?',
      [resetRecord.id]
    );

    res.render('auth/reset-password-success', { 
      mensaje: 'Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión.',
      session: req.session 
    });

  } catch (err) {
    console.error(err);
    res.render('auth/reset-password', { 
      error: 'Error al actualizar la contraseña.',
      token: token,
      session: req.session 
    });
  }
};