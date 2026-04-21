const transporter = require('../config/mailer');
const db = require('../models/db');
const jwt = require('jsonwebtoken');

// ========================================
// NOTIFICACIONES DEL SISTEMA
// ========================================

// 1. Enviar correo cuando se crea un reporte
async function enviarNotificacionNuevoReporte(reporte, destinatario, tipoDestinatario) {
  const estadoMap = {
    'Pendiente': '⏳ Pendiente',
    'En Progreso': '🔄 En Progreso',
    'Resuelto': '✅ Resuelto'
  };

  const mailOptions = {
    from: `"ComuniSolve" <${process.env.EMAIL_USER}>`,
    to: destinatario.email,
    subject: `📢 Nuevo reporte: ${reporte.titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center;">
          <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
        </div>
        <h2 style="color: #5D4037; text-align: center;">¡Nuevo reporte registrado!</h2>
        <p><strong>Hola ${destinatario.nombre},</strong></p>
        <p>Se ha registrado un nuevo reporte en ${tipoDestinatario === 'jefe' ? 'tu calle' : 'tu comunidad'}:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
          <p><strong>📝 Descripción:</strong> ${reporte.descripcion.substring(0, 150)}${reporte.descripcion.length > 150 ? '...' : ''}</p>
          <p><strong>🏷️ Categoría:</strong> ${reporte.categoria_nombre || reporte.categoria}</p>
          <p><strong>📍 Calle:</strong> ${reporte.nombre_calle}</p>
          <p><strong>📅 Fecha:</strong> ${new Date(reporte.fecha).toLocaleString()}</p>
          <p><strong>📌 Estado:</strong> <span style="color: ${reporte.estado === 'Pendiente' ? '#ffc107' : reporte.estado === 'En Progreso' ? '#17a2b8' : '#28a745'}">${estadoMap[reporte.estado]}</span></p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/reportes" 
             style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
             Ver reporte
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 0.7em; color: #aaa; text-align: center;">© ${new Date().getFullYear()} ComuniSolve - Gestión Comunitaria</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Correo nuevo reporte enviado a:", destinatario.email);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    return { success: false, error };
  }
}

// 2. Enviar correo cuando cambia el estado
async function enviarNotificacionCambioEstado(reporte, destinatario, estadoAnterior, estadoNuevo) {
  const estadoMap = {
    'Pendiente': '⏳ Pendiente',
    'En Progreso': '🔄 En Progreso',
    'Resuelto': '✅ Resuelto'
  };

  const mailOptions = {
    from: `"ComuniSolve" <${process.env.EMAIL_USER}>`,
    to: destinatario.email,
    subject: `📢 Estado actualizado: ${reporte.titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center;">
          <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
        </div>
        <h2 style="color: #5D4037; text-align: center;">Estado del reporte actualizado</h2>
        <p><strong>Hola ${destinatario.nombre},</strong></p>
        <p>El estado de tu reporte ha cambiado:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
          <p><strong>🔄 Estado anterior:</strong> <span style="color: #6c757d">${estadoMap[estadoAnterior]}</span></p>
          <p><strong>🆕 Estado actual:</strong> <span style="color: ${estadoNuevo === 'Pendiente' ? '#ffc107' : estadoNuevo === 'En Progreso' ? '#17a2b8' : '#28a745'}">${estadoMap[estadoNuevo]}</span></p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/reportes" 
             style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
             Ver reporte
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 0.7em; color: #aaa; text-align: center;">© ${new Date().getFullYear()} ComuniSolve - Gestión Comunitaria</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Correo cambio estado enviado a:", destinatario.email);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    return { success: false, error };
  }
}

// 3. Enviar correo cuando se asigna empresa
async function enviarNotificacionEmpresaAsignada(reporte, destinatario, empresa) {
  const mailOptions = {
    from: `"ComuniSolve" <${process.env.EMAIL_USER}>`,
    to: destinatario.email,
    subject: `🏢 Empresa asignada: ${reporte.titulo}`,
    html: `
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
          <a href="${process.env.APP_URL}/reportes" 
             style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
             Ver reporte
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 0.7em; color: #aaa; text-align: center;">© ${new Date().getFullYear()} ComuniSolve - Gestión Comunitaria</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Correo empresa asignada enviado a:", destinatario.email);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    return { success: false, error };
  }
}

// 4. Enviar correo cuando se aprueba/rechaza voluntario
async function enviarNotificacionVoluntario(voluntario, estado, motivo = '') {
  const mailOptions = {
    from: `"ComuniSolve" <${process.env.EMAIL_USER}>`,
    to: voluntario.email,
    subject: estado === 'aprobado' ? '✅ ¡Bienvenido como voluntario!' : '📋 Actualización de tu solicitud',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center;">
          <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
        </div>
        ${estado === 'aprobado' ? `
          <h2 style="color: #28a745; text-align: center;">¡Felicidades!</h2>
          <p><strong>Hola ${voluntario.nombre},</strong></p>
          <p>Tu solicitud para ser voluntario ha sido <strong style="color: #28a745;">APROBADA</strong>.</p>
          <p>Ahora formas parte del equipo de voluntarios de la Comuna Socialista Nuestra Señora de las Mercedes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/voluntarios" 
               style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
               Ver mi perfil
            </a>
          </div>
        ` : `
          <h2 style="color: #dc3545; text-align: center;">Actualización de tu solicitud</h2>
          <p><strong>Hola ${voluntario.nombre},</strong></p>
          <p>Tu solicitud para ser voluntario ha sido <strong style="color: #dc3545;">RECHAZADA</strong>.</p>
          ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
          <p>Puedes volver a postularte en cualquier momento.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/voluntarios" 
               style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
               Volver a postular
            </a>
          </div>
        `}
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 0.7em; color: #aaa; text-align: center;">© ${new Date().getFullYear()} ComuniSolve - Gestión Comunitaria</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Correo de voluntario ${estado} enviado a:`, voluntario.email);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    return { success: false, error };
  }
}

// ========================================
// RECUPERACIÓN DE CONTRASEÑA
// ========================================

// 5. Enviar correo de recuperación de contraseña
async function enviarCorreoRecuperacion(usuario, token) {
  const resetLink = `${process.env.APP_URL}/reset-password/${token}`;
  
  const mailOptions = {
    from: `"ComuniSolve" <${process.env.EMAIL_USER}>`,
    to: usuario.email,
    subject: "🔐 Recuperación de Contraseña - ComuniSolve",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center;">
          <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
        </div>
        <h2 style="color: #5D4037; text-align: center;">Restablecer tu contraseña</h2>
        <p><strong>Hola ${usuario.nombre},</strong></p>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en ComuniSolve.</p>
        <p>Haz clic en el botón de abajo para continuar. Este enlace expira en <strong>1 hora</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
             Restablecer Contraseña
          </a>
        </div>
        <p style="font-size: 0.8em; color: #777;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 0.7em; color: #aaa; text-align: center;">© ${new Date().getFullYear()} ComuniSolve - Gestión Comunitaria</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Correo de recuperación enviado a:", usuario.email);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando correo de recuperación:", error);
    return { success: false, error };
  }
}

// 6. Enviar correo cuando se asigna un reporte a un voluntario
async function enviarNotificacionAsignacionVoluntario(voluntario, reporte) {
  const mailOptions = {
    from: `"ComuniSolve" <${process.env.EMAIL_USER}>`,
    to: voluntario.email,
    subject: `👥 Nueva asignación: ${reporte.titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center;">
          <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
        </div>
        <h2 style="color: #fd6704bd; text-align: center;">¡Te han asignado un reporte!</h2>
        <p><strong>Hola ${voluntario.nombre},</strong></p>
        <p>Se te ha asignado un reporte para que puedas ayudar a la comunidad:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
          <p><strong>📝 Descripción:</strong> ${reporte.descripcion.substring(0, 150)}${reporte.descripcion.length > 150 ? '...' : ''}</p>
          <p><strong>📍 Calle:</strong> ${reporte.nombre_calle}</p>
          <p><strong>📌 Estado:</strong> ${reporte.estado}</p>
        </div>
        <p>Por favor, ingresa a tu perfil de voluntario para aceptar o rechazar esta asignación.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/voluntarios/mi-perfil" 
             style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
             Ver mi perfil
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 0.7em; color: #aaa; text-align: center;">© ${new Date().getFullYear()} ComuniSolve - Gestión Comunitaria</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Correo de asignación de voluntario enviado a:", voluntario.email);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando email de asignación:", error);
    return { success: false, error };
  }
}

// 7. Notificar a líder/jefe/UBCH cuando hay un nuevo voluntario pendiente
async function enviarNotificacionNuevoVoluntario(administrador, voluntario) {
  const mailOptions = {
    from: `"ComuniSolve" <${process.env.EMAIL_USER}>`,
    to: administrador.email,
    subject: "🆕 Nuevo voluntario pendiente de aprobación",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <div style="text-align: center;">
          <img src="${process.env.APP_URL}/images/isologo.png" alt="ComuniSolve" style="max-height: 60px;">
        </div>
        <h2 style="color: #fd6704bd; text-align: center;">¡Nuevo voluntario registrado!</h2>
        <p><strong>Hola ${administrador.nombre},</strong></p>
        <p>Un nuevo ciudadano se ha postulado como voluntario y está esperando tu aprobación:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>👤 Nombre:</strong> ${voluntario.nombre}</p>
          <p><strong>🛠️ Habilidad:</strong> ${voluntario.habilidad}</p>
          <p><strong>📞 Teléfono:</strong> ${voluntario.telefono || 'No especificado'}</p>
          <p><strong>📅 Fecha de postulación:</strong> ${new Date(voluntario.fecha_solicitud).toLocaleDateString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.APP_URL}/voluntarios/gestionar" 
             style="background-color: #fd6704bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
             Gestionar voluntarios
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 0.7em; color: #aaa; text-align: center;">© ${new Date().getFullYear()} ComuniSolve - Gestión Comunitaria</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Correo de nuevo voluntario enviado a:", administrador.email);
    return { success: true };
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    return { success: false, error };
  }
}

// 8. Notificar a voluntario cuando se le asigna un reporte (ya la tenemos arriba)

module.exports = {
  enviarNotificacionNuevoReporte,
  enviarNotificacionCambioEstado,
  enviarNotificacionEmpresaAsignada,
  enviarNotificacionVoluntario,
  enviarCorreoRecuperacion,
  enviarNotificacionAsignacionVoluntario  // 👈 NUEVA
};