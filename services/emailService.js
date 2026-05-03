const { resend, EMAIL_FROM } = require('../config/mailer');

// ========================================
// FUNCIÓN GENÉRICA PARA ENVIAR EMAILS
// ========================================
async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    console.log('⚠️ RESEND_API_KEY no configurada, email no enviado a:', to);
    return { success: false, error: 'API key no configurada' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `ComuniSolve <${EMAIL_FROM}>`,
      to: to,
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('❌ Error Resend:', error);
      return { success: false, error };
    }

    console.log(`✅ Email enviado a: ${to} - Subject: ${subject}`);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    return { success: false, error: error.message };
  }
}

// ========================================
// 1. NUEVO REPORTE
// ========================================
async function enviarNotificacionNuevoReporte(reporte, destinatario, tipoDestinatario) {
  const estadoMap = {
    'Pendiente': '⏳ Pendiente',
    'En Progreso': '🔄 En Progreso',
    'Resuelto': '✅ Resuelto'
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nuevo Reporte</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
        <div style="background-color: #fd6704bd; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">ComuniSolve</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #5D4037; text-align: center;">¡Nuevo reporte registrado!</h2>
          <p><strong>Hola ${destinatario.nombre},</strong></p>
          <p>Se ha registrado un nuevo reporte en ${tipoDestinatario === 'jefe' ? 'tu calle' : 'tu comunidad'}:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
            <p><strong>📝 Descripción:</strong> ${reporte.descripcion ? reporte.descripcion.substring(0, 150) : 'Sin descripción'}${reporte.descripcion && reporte.descripcion.length > 150 ? '...' : ''}</p>
            <p><strong>🏷️ Categoría:</strong> ${reporte.categoria_nombre || reporte.categoria || 'General'}</p>
            <p><strong>📍 Calle:</strong> ${reporte.nombre_calle}</p>
            <p><strong>📅 Fecha:</strong> ${new Date(reporte.fecha).toLocaleString()}</p>
            <p><strong>📌 Estado:</strong> <span style="color: ${reporte.estado === 'Pendiente' ? '#ffc107' : reporte.estado === 'En Progreso' ? '#17a2b8' : '#28a745'}">${estadoMap[reporte.estado] || reporte.estado}</span></p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/reportes" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Ver reporte
            </a>
          </div>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          <p>© ${new Date().getFullYear()} ComuniSolve - Gestión Comunitaria</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(destinatario.email, `📢 Nuevo reporte: ${reporte.titulo}`, html);
}

// ========================================
// 2. CAMBIO DE ESTADO
// ========================================
async function enviarNotificacionCambioEstado(reporte, destinatario, estadoAnterior, estadoNuevo) {
  const estadoMap = {
    'Pendiente': '⏳ Pendiente',
    'En Progreso': '🔄 En Progreso',
    'Resuelto': '✅ Resuelto'
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Cambio de Estado</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #fd6704bd; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">ComuniSolve</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #5D4037; text-align: center;">Estado del reporte actualizado</h2>
          <p><strong>Hola ${destinatario.nombre},</strong></p>
          <p>El estado de tu reporte ha cambiado:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
            <p><strong>🔄 Estado anterior:</strong> <span style="color: #6c757d">${estadoMap[estadoAnterior] || estadoAnterior}</span></p>
            <p><strong>🆕 Estado actual:</strong> <span style="color: ${estadoNuevo === 'Pendiente' ? '#ffc107' : estadoNuevo === 'En Progreso' ? '#17a2b8' : '#28a745'}">${estadoMap[estadoNuevo] || estadoNuevo}</span></p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/reportes" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver reporte
            </a>
          </div>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          <p>© ${new Date().getFullYear()} ComuniSolve</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(destinatario.email, `📢 Estado actualizado: ${reporte.titulo}`, html);
}

// ========================================
// 3. EMPRESA ASIGNADA
// ========================================
async function enviarNotificacionEmpresaAsignada(reporte, destinatario, empresa) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Empresa Asignada</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #fd6704bd; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">ComuniSolve</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #5D4037; text-align: center;">Empresa responsable asignada</h2>
          <p><strong>Hola ${destinatario.nombre},</strong></p>
          <p>Se ha asignado una empresa responsable para atender tu reporte:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>📌 Reporte:</strong> ${reporte.titulo}</p>
            <p><strong>🏢 Empresa:</strong> ${empresa.nombre}</p>
            ${empresa.contacto ? `<p><strong>👤 Contacto:</strong> ${empresa.contacto}</p>` : ''}
            ${empresa.telefono ? `<p><strong>📞 Teléfono:</strong> ${empresa.telefono}</p>` : ''}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/reportes" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver reporte
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(destinatario.email, `🏢 Empresa asignada: ${reporte.titulo}`, html);
}

// ========================================
// 4. NOTIFICACIÓN VOLUNTARIO (aprobado/rechazado)
// ========================================
async function enviarNotificacionVoluntario(voluntario, estado, motivo = '') {
  const html = estado === 'aprobado' ? `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: auto; background: white; padding: 20px;">
        <h2 style="color: #28a745;">¡Felicidades!</h2>
        <p><strong>Hola ${voluntario.nombre},</strong></p>
        <p>Tu solicitud para ser voluntario ha sido <strong style="color: #28a745;">APROBADA</strong>.</p>
        <p>Ahora formas parte del equipo de voluntarios de la Comuna.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/voluntarios" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Ver mi perfil
          </a>
        </div>
      </div>
    </body>
    </html>
  ` : `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: auto; background: white; padding: 20px;">
        <h2 style="color: #dc3545;">Actualización de tu solicitud</h2>
        <p><strong>Hola ${voluntario.nombre},</strong></p>
        <p>Tu solicitud para ser voluntario ha sido <strong style="color: #dc3545;">RECHAZADA</strong>.</p>
        ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/voluntarios" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Volver a postular
          </a>
        </div>
      </div>
    </body>
    </html>
  `;

  const subject = estado === 'aprobado' ? '✅ ¡Bienvenido como voluntario!' : '📋 Actualización de tu solicitud';
  return sendEmail(voluntario.email, subject, html);
}

// ========================================
// 5. RECUPERACIÓN DE CONTRASEÑA
// ========================================
async function enviarCorreoRecuperacion(usuario, token) {
  const resetLink = `${process.env.APP_URL || 'https://comunisolve.onrender.com'}/reset-password/${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #fd6704bd; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">ComuniSolve</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #5D4037; text-align: center;">Restablecer tu contraseña</h2>
          <p><strong>Hola ${usuario.nombre},</strong></p>
          <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
          <p>Haz clic en el botón de abajo para continuar. Este enlace expira en <strong>1 hora</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          <p style="font-size: 0.8em; color: #777;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          <p>© ${new Date().getFullYear()} ComuniSolve</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(usuario.email, "🔐 Recuperación de Contraseña", html);
}

// ========================================
// 6. ASIGNACIÓN DE VOLUNTARIO A REPORTE
// ========================================
async function enviarNotificacionAsignacionVoluntario(voluntario, reporte) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: auto; background: white; padding: 20px;">
        <h2 style="color: #fd6704bd;">¡Te han asignado un reporte!</h2>
        <p><strong>Hola ${voluntario.nombre},</strong></p>
        <p>Se te ha asignado un reporte para que puedas ayudar a la comunidad:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
          <p><strong>📝 Descripción:</strong> ${reporte.descripcion ? reporte.descripcion.substring(0, 150) : 'Sin descripción'}</p>
          <p><strong>📍 Calle:</strong> ${reporte.nombre_calle}</p>
          <p><strong>📌 Estado:</strong> ${reporte.estado}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/voluntarios/mi-perfil" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Ver mi perfil
          </a>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(voluntario.email, `👥 Nueva asignación: ${reporte.titulo}`, html);
}

// ========================================
// 7. NUEVO VOLUNTARIO (para admins)
// ========================================
async function enviarNotificacionNuevoVoluntario(administrador, voluntario) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: auto; background: white; padding: 20px;">
        <h2 style="color: #fd6704bd;">¡Nuevo voluntario registrado!</h2>
        <p><strong>Hola ${administrador.nombre},</strong></p>
        <p>Un nuevo ciudadano se ha postulado como voluntario:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>👤 Nombre:</strong> ${voluntario.nombre}</p>
          <p><strong>🛠️ Habilidad:</strong> ${voluntario.habilidad}</p>
          <p><strong>📞 Teléfono:</strong> ${voluntario.telefono || 'No especificado'}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/voluntarios/gestionar" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Gestionar voluntarios
          </a>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(administrador.email, "🆕 Nuevo voluntario pendiente de aprobación", html);
}

// ========================================
// 8. NUEVO USUARIO (para admins)
// ========================================
async function enviarNotificacionNuevoUsuario(administrador, nuevoUsuario) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: auto; background: white; padding: 20px;">
        <h2 style="color: #fd6704bd;">¡Nuevo ciudadano registrado!</h2>
        <p><strong>Hola ${administrador.nombre},</strong></p>
        <p>Un nuevo ciudadano se ha registrado:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
          <p><strong>👤 Nombre:</strong> ${nuevoUsuario.nombre}</p>
          <p><strong>📧 Email:</strong> ${nuevoUsuario.email}</p>
          <p><strong>📍 Calle:</strong> ${nuevoUsuario.calle}</p>
        </div>
        <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/usuarios">Gestionar usuarios</a>
      </div>
    </body>
    </html>
  `;
  return sendEmail(administrador.email, "🆕 Nuevo ciudadano pendiente de aprobación", html);
}

// ========================================
// 9. ESTADO DE USUARIO (aprobado/rechazado)
// ========================================
async function enviarNotificacionEstadoUsuario(usuario, estado, motivo = '') {
  const html = estado === 'aprobado' ? `
    <!DOCTYPE html>
    <html>
    <body>
      <div style="max-width: 600px; margin: auto; padding: 20px;">
        <h2 style="color: #28a745;">¡Cuenta aprobada!</h2>
        <p>Hola ${usuario.nombre}, tu cuenta ha sido APROBADA. Ya puedes iniciar sesión.</p>
        <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/login">Iniciar sesión</a>
      </div>
    </body>
    </html>
  ` : `
    <!DOCTYPE html>
    <html>
    <body>
      <div style="max-width: 600px; margin: auto; padding: 20px;">
        <h2 style="color: #dc3545;">Cuenta rechazada</h2>
        <p>Hola ${usuario.nombre}, tu solicitud ha sido RECHAZADA.</p>
        ${motivo ? `<p>Motivo: ${motivo}</p>` : ''}
        <a href="${process.env.APP_URL || 'https://comunisolve.onrender.com'}/registro">Volver a registrarse</a>
      </div>
    </body>
    </html>
  `;
  const subject = estado === 'aprobado' ? '✅ ¡Tu cuenta ha sido aprobada!' : '📋 Actualización de tu cuenta';
  return sendEmail(usuario.email, subject, html);
}

module.exports = {
  enviarNotificacionNuevoReporte,
  enviarNotificacionCambioEstado,
  enviarNotificacionEmpresaAsignada,
  enviarNotificacionVoluntario,
  enviarCorreoRecuperacion,
  enviarNotificacionAsignacionVoluntario,
  enviarNotificacionNuevoVoluntario,
  enviarNotificacionNuevoUsuario,
  enviarNotificacionEstadoUsuario
};