const mailjet = require('../config/mailjet');

// Email de origen (debe ser el mismo con el que te registraste en Mailjet)
const FROM_EMAIL = process.env.MAILJET_FROM_EMAIL || 'comunisolve@gmail.com';
const FROM_NAME = 'ComuniSolve';

// Función genérica para enviar emails con Mailjet
async function sendEmail(to, subject, htmlContent) {
  if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
    console.log('⚠️ Mailjet no configurado. Faltan API keys.');
    return { success: false, error: 'Mailjet no configurado' };
  }

  try {
    const request = mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: FROM_EMAIL,
            Name: FROM_NAME
          },
          To: [
            {
              Email: to
            }
          ],
          Subject: subject,
          HTMLPart: htmlContent
        }
      ]
    });
    
    const result = await request;
    console.log(`✅ Email enviado a: ${to}`);
    return { success: true, result };
  } catch (error) {
    console.error('❌ Error enviando email con Mailjet:', error.message);
    return { success: false, error: error.message };
  }
}

// ========================================
// 1. RECUPERACIÓN DE CONTRASEÑA
// ========================================
async function enviarCorreoRecuperacion(usuario, token) {
  const resetLink = `${process.env.APP_URL}/reset-password/${token}`;
  
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
            <a href="${resetLink}" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          <p style="font-size: 0.8em; color: #777;">Si no solicitaste esto, ignora este correo.</p>
        </div>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
          <p>© ${new Date().getFullYear()} ComuniSolve</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(usuario.email, "🔐 Recuperación de Contraseña - ComuniSolve", html);
}

// ========================================
// 2. NUEVO REPORTE
// ========================================
async function enviarNotificacionNuevoReporte(reporte, destinatario, tipoDestinatario) {
  const estadoMap = {
    'Pendiente': '⏳ Pendiente',
    'En Progreso': '🔄 En Progreso',
    'Resuelto': '✅ Resuelto'
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
      </div>
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
        <a href="${process.env.APP_URL}/reportes" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Ver reporte</a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="font-size: 0.7em; color: #aaa; text-align: center;">© ${new Date().getFullYear()} ComuniSolve</p>
    </div>
  `;
  return sendEmail(destinatario.email, `📢 Nuevo reporte: ${reporte.titulo}`, html);
}

// ========================================
// 3. CAMBIO DE ESTADO
// ========================================
async function enviarNotificacionCambioEstado(reporte, destinatario, estadoAnterior, estadoNuevo) {
  const estadoMap = {
    'Pendiente': '⏳ Pendiente',
    'En Progreso': '🔄 En Progreso',
    'Resuelto': '✅ Resuelto'
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
      </div>
      <h2 style="color: #5D4037; text-align: center;">Estado del reporte actualizado</h2>
      <p><strong>Hola ${destinatario.nombre},</strong></p>
      <p>El estado de tu reporte ha cambiado:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
        <p><strong>🔄 Estado anterior:</strong> <span style="color: #6c757d">${estadoMap[estadoAnterior] || estadoAnterior}</span></p>
        <p><strong>🆕 Estado actual:</strong> <span style="color: ${estadoNuevo === 'Pendiente' ? '#ffc107' : estadoNuevo === 'En Progreso' ? '#17a2b8' : '#28a745'}">${estadoMap[estadoNuevo] || estadoNuevo}</span></p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.APP_URL}/reportes" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Ver reporte</a>
      </div>
    </div>
  `;
  return sendEmail(destinatario.email, `📢 Estado actualizado: ${reporte.titulo}`, html);
}

// ========================================
// 4. EMPRESA ASIGNADA
// ========================================
async function enviarNotificacionEmpresaAsignada(reporte, destinatario, empresa) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
      </div>
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
        <a href="${process.env.APP_URL}/reportes" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Ver reporte</a>
      </div>
    </div>
  `;
  return sendEmail(destinatario.email, `🏢 Empresa asignada: ${reporte.titulo}`, html);
}

// ========================================
// 5. VOLUNTARIO APROBADO/RECHAZADO
// ========================================
async function enviarNotificacionVoluntario(voluntario, estado, motivo = '') {
  const subject = estado === 'aprobado' ? '✅ ¡Bienvenido como voluntario!' : '📋 Actualización de tu solicitud';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
      </div>
      ${estado === 'aprobado' ? `
        <h2 style="color: #28a745; text-align: center;">¡Felicidades!</h2>
        <p><strong>Hola ${voluntario.nombre},</strong></p>
        <p>Tu solicitud para ser voluntario ha sido <strong style="color: #28a745;">APROBADA</strong>.</p>
        <p>Ahora formas parte del equipo de voluntarios.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/voluntarios" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Ver mi perfil</a>
        </div>
      ` : `
        <h2 style="color: #dc3545; text-align: center;">Actualización de tu solicitud</h2>
        <p><strong>Hola ${voluntario.nombre},</strong></p>
        <p>Tu solicitud para ser voluntario ha sido <strong style="color: #dc3545;">RECHAZADA</strong>.</p>
        ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/voluntarios" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Volver a postular</a>
        </div>
      `}
    </div>
  `;
  return sendEmail(voluntario.email, subject, html);
}

// ========================================
// 6. ASIGNACIÓN A VOLUNTARIO
// ========================================
async function enviarNotificacionAsignacionVoluntario(voluntario, reporte) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
      </div>
      <h2 style="color: #fd6704bd; text-align: center;">¡Te han asignado un reporte!</h2>
      <p><strong>Hola ${voluntario.nombre},</strong></p>
      <p>Se te ha asignado un reporte:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
        <p><strong>📍 Calle:</strong> ${reporte.nombre_calle}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.APP_URL}/voluntarios/mi-perfil" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Ver mi perfil</a>
      </div>
    </div>
  `;
  return sendEmail(voluntario.email, `👥 Nueva asignación: ${reporte.titulo}`, html);
}

// ========================================
// 7. NUEVO VOLUNTARIO (para admins)
// ========================================
async function enviarNotificacionNuevoVoluntario(administrador, voluntario) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
      </div>
      <h2 style="color: #fd6704bd; text-align: center;">¡Nuevo voluntario registrado!</h2>
      <p><strong>Hola ${administrador.nombre},</strong></p>
      <p>Un nuevo ciudadano se ha postulado:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
        <p><strong>👤 Nombre:</strong> ${voluntario.nombre}</p>
        <p><strong>🛠️ Habilidad:</strong> ${voluntario.habilidad}</p>
        <p><strong>📞 Teléfono:</strong> ${voluntario.telefono || 'No especificado'}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.APP_URL}/voluntarios/gestionar" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Gestionar</a>
      </div>
    </div>
  `;
  return sendEmail(administrador.email, "🆕 Nuevo voluntario pendiente de aprobación", html);
}

// ========================================
// 8. NUEVO USUARIO (para admins)
// ========================================
async function enviarNotificacionNuevoUsuario(administrador, nuevoUsuario) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
      </div>
      <h2 style="color: #fd6704bd; text-align: center;">¡Nuevo ciudadano registrado!</h2>
      <p><strong>Hola ${administrador.nombre},</strong></p>
      <p>Un nuevo ciudadano se ha registrado:</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 8px;">
        <p><strong>👤 Nombre:</strong> ${nuevoUsuario.nombre}</p>
        <p><strong>📧 Email:</strong> ${nuevoUsuario.email}</p>
        <p><strong>📍 Calle:</strong> ${nuevoUsuario.calle}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.APP_URL}/usuarios" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Gestionar usuarios</a>
      </div>
    </div>
  `;
  return sendEmail(administrador.email, "🆕 Nuevo ciudadano pendiente de aprobación", html);
}

// ========================================
// 9. ESTADO DE USUARIO (aprobado/rechazado)
// ========================================
async function enviarNotificacionEstadoUsuario(usuario, estado, motivo = '') {
  const subject = estado === 'aprobado' ? '✅ ¡Tu cuenta ha sido aprobada!' : '📋 Actualización de tu cuenta';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <div style="text-align: center;">
        <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
      </div>
      ${estado === 'aprobado' ? `
        <h2 style="color: #28a745; text-align: center;">¡Cuenta aprobada!</h2>
        <p><strong>Hola ${usuario.nombre},</strong></p>
        <p>Tu cuenta ha sido <strong style="color: #28a745;">APROBADA</strong>.</p>
        <p>Ya puedes iniciar sesión.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/login" style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Iniciar sesión</a>
        </div>
      ` : `
        <h2 style="color: #dc3545; text-align: center;">Actualización de tu cuenta</h2>
        <p><strong>Hola ${usuario.nombre},</strong></p>
        <p>Tu solicitud ha sido <strong style="color: #dc3545;">RECHAZADA</strong>.</p>
        ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/registro" style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Volver a registrarse</a>
        </div>
      `}
    </div>
  `;
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