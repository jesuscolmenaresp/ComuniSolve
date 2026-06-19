const mailjet = require('../config/mailjet');
const nodemailer = require('nodemailer');

// Configurar transporter para Gmail (local)
let transporter = null;
if (process.env.NODE_ENV !== 'production') {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER || 'comunisolve@gmail.com',
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
    console.log('📧 Nodemailer configurado para entorno LOCAL');
} else {
    console.log('📧 Mailjet configurado para entorno PRODUCCIÓN');
}

// Email de origen
const FROM_EMAIL = process.env.MAILJET_FROM_EMAIL || 'comunisolve@gmail.com';
const FROM_NAME = 'ComuniSolve - Gestión Comunitaria';

// ========================================
// 📌 FUNCIÓN PRINCIPAL DE ENVÍO
// ========================================
async function sendEmail(to, subject, htmlContent) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
        return sendWithMailjet(to, subject, htmlContent);
    } else {
        return sendWithNodemailer(to, subject, htmlContent);
    }
}

// ========================================
// 📌 ENVÍO CON MAILJET (Producción) - CORREGIDO
// ========================================
async function sendWithMailjet(to, subject, htmlContent) {
    if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) {
        console.log('⚠️ Mailjet no configurado. Faltan API keys.');
        return { success: false, error: 'Mailjet no configurado' };
    }

    try {
        // Versión de texto plano
        const textContent = htmlContent
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const request = mailjet.post('send', { version: 'v3.1' }).request({
            Messages: [{
                From: {
                    Email: FROM_EMAIL,
                    Name: FROM_NAME
                },
                To: [{ Email: to }],
                Subject: subject,
                HTMLPart: htmlContent,
                TextPart: textContent || 'Para ver este correo correctamente, abre la versión HTML.',
                CustomCampaign: 'ComuniSolve-Notifications'
            }]
        });
        
        const result = await request;
        console.log(`✅ [Mailjet] Email enviado a: ${to}`);
        return { success: true, result, provider: 'Mailjet' };
    } catch (error) {
        console.error('❌ [Mailjet] Error:', error.message);
        if (error.statusCode) {
            console.error('📌 Código de estado:', error.statusCode);
        }
        return { success: false, error: error.message, provider: 'Mailjet' };
    }
}

// ========================================
// 📌 ENVÍO CON NODEMAILER (Local)
// ========================================
async function sendWithNodemailer(to, subject, htmlContent) {
    if (!transporter) {
        console.log('⚠️ Nodemailer no configurado correctamente.');
        return { success: false, error: 'Nodemailer no configurado' };
    }

    try {
        const textContent = htmlContent
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const info = await transporter.sendMail({
            from: `"${FROM_NAME}" <${process.env.GMAIL_USER || FROM_EMAIL}>`,
            to: to,
            subject: subject,
            html: htmlContent,
            text: textContent || 'Para ver este correo correctamente, abre la versión HTML.'
        });

        console.log(`✅ [Nodemailer] Email enviado a: ${to}`);
        return { success: true, info, provider: 'Nodemailer' };
    } catch (error) {
        console.error('❌ [Nodemailer] Error:', error.message);
        return { success: false, error: error.message, provider: 'Nodemailer' };
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
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperación de Contraseña</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .header p { color: rgba(255,255,255,0.9); margin: 5px 0 0; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: #5D4037; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #fd6704bd; margin: 15px 0; }
            .info-box p { margin: 5px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏠 ComuniSolve</h1>
                <p>Gestión Comunitaria Inteligente</p>
            </div>
            <div class="body">
                <h2>🔐 Restablecer tu contraseña</h2>
                <p><strong>Hola ${usuario.nombre},</strong></p>
                <p>Hemos recibido una solicitud para restablecer tu contraseña en <strong>ComuniSolve</strong>.</p>
                <div class="info-box">
                    <p>🔑 <strong>¿Qué hacer?</strong></p>
                    <p>Haz clic en el botón de abajo para continuar con el proceso.</p>
                    <p>⏰ Este enlace expira en <strong>1 hora</strong>.</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" class="btn">🔐 Restablecer Contraseña</a>
                </div>
                <div style="background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 15px 0;">
                    <p style="margin: 0; font-size: 13px; color: #856404;">
                        ⚠️ Si no solicitaste este cambio, ignora este correo. Tu cuenta permanecerá segura.
                    </p>
                </div>
                <p style="font-size: 13px; color: #6c757d; margin-top: 20px;">
                    <strong>💡 Consejo:</strong> Agrega <strong>comunisolve@gmail.com</strong> a tus contactos.
                </p>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
                <p style="font-size: 10px; color: #aaa;">Este es un correo automático. Por favor, no respondas a este mensaje.</p>
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
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo Reporte</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: #5D4037; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #fd6704bd; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📢 ComuniSolve</h1>
                <p>Gestión Comunitaria Inteligente</p>
            </div>
            <div class="body">
                <h2>📋 ¡Nuevo reporte registrado!</h2>
                <p><strong>Hola ${destinatario.nombre},</strong></p>
                <p>Se ha registrado un nuevo reporte en <strong>${tipoDestinatario === 'jefe' ? 'tu calle' : 'tu comunidad'}</strong>.</p>
                <div class="info-box">
                    <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
                    <p><strong>📍 Calle:</strong> ${reporte.nombre_calle}</p>
                    <p><strong>📅 Fecha:</strong> ${new Date(reporte.fecha).toLocaleString()}</p>
                    <p><strong>📌 Estado:</strong> ${estadoMap[reporte.estado] || reporte.estado}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/reportes" class="btn">👁️ Ver reporte</a>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
            </div>
        </div>
    </body>
    </html>
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
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Estado Actualizado</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: #5D4037; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #fd6704bd; margin: 15px 0; }
            .estado-nuevo { font-weight: bold; color: ${estadoNuevo === 'Pendiente' ? '#ffc107' : estadoNuevo === 'En Progreso' ? '#17a2b8' : '#28a745'}; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔄 ComuniSolve</h1>
                <p>Gestión Comunitaria Inteligente</p>
            </div>
            <div class="body">
                <h2>🔄 Estado del reporte actualizado</h2>
                <p><strong>Hola ${destinatario.nombre},</strong></p>
                <p>El estado de tu reporte ha cambiado:</p>
                <div class="info-box">
                    <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
                    <p><strong>🔄 Estado anterior:</strong> ${estadoMap[estadoAnterior] || estadoAnterior}</p>
                    <p><strong>🆕 Estado actual:</strong> <span class="estado-nuevo">${estadoMap[estadoNuevo] || estadoNuevo}</span></p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/reportes" class="btn">👁️ Ver reporte</a>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
            </div>
        </div>
    </body>
    </html>
    `;
    return sendEmail(destinatario.email, `📢 Estado actualizado: ${reporte.titulo}`, html);
}

// ========================================
// 4. EMPRESA ASIGNADA
// ========================================
async function enviarNotificacionEmpresaAsignada(reporte, destinatario, empresa) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Empresa Asignada</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: #5D4037; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏢 ComuniSolve</h1>
                <p>Gestión Comunitaria Inteligente</p>
            </div>
            <div class="body">
                <h2>🏢 Empresa responsable asignada</h2>
                <p><strong>Hola ${destinatario.nombre},</strong></p>
                <p>Se ha asignado una empresa responsable para atender tu reporte:</p>
                <div class="info-box">
                    <p><strong>📌 Reporte:</strong> ${reporte.titulo}</p>
                    <p><strong>🏢 Empresa:</strong> ${empresa.nombre}</p>
                    ${empresa.contacto ? `<p><strong>👤 Contacto:</strong> ${empresa.contacto}</p>` : ''}
                    ${empresa.telefono ? `<p><strong>📞 Teléfono:</strong> ${empresa.telefono}</p>` : ''}
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/reportes" class="btn">👁️ Ver reporte</a>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
            </div>
        </div>
    </body>
    </html>
    `;
    return sendEmail(destinatario.email, `🏢 Empresa asignada: ${reporte.titulo}`, html);
}

// ========================================
// 5. VOLUNTARIO APROBADO/RECHAZADO
// ========================================
async function enviarNotificacionVoluntario(voluntario, estado, motivo = '') {
    const subject = estado === 'aprobado' ? '✅ ¡Bienvenido como voluntario!' : '📋 Actualización de tu solicitud';
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${estado === 'aprobado' ? 'Voluntario Aprobado' : 'Actualización de Solicitud'}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: ${estado === 'aprobado' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'}; padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: ${estado === 'aprobado' ? '#28a745' : '#dc3545'}; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: ${estado === 'aprobado' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%)'}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid ${estado === 'aprobado' ? '#28a745' : '#dc3545'}; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤝 ComuniSolve</h1>
                <p>${estado === 'aprobado' ? '¡Bienvenido al equipo!' : 'Actualización de tu solicitud'}</p>
            </div>
            <div class="body">
                ${estado === 'aprobado' ? `
                    <h2>✅ ¡Felicidades!</h2>
                    <p><strong>Hola ${voluntario.nombre},</strong></p>
                    <p>Tu solicitud para ser voluntario ha sido <strong style="color: #28a745;">APROBADA</strong>.</p>
                    <p>Ahora formas parte del equipo de voluntarios de <strong>ComuniSolve</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL}/voluntarios/mi-perfil" class="btn">👤 Ver mi perfil</a>
                    </div>
                ` : `
                    <h2>📋 Actualización de tu solicitud</h2>
                    <p><strong>Hola ${voluntario.nombre},</strong></p>
                    <p>Tu solicitud para ser voluntario ha sido <strong style="color: #dc3545;">RECHAZADA</strong>.</p>
                    ${motivo ? `<div class="info-box"><p><strong>📝 Motivo:</strong> ${motivo}</p></div>` : ''}
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL}/voluntarios" class="btn">🔄 Volver a postular</a>
                    </div>
                `}
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
            </div>
        </div>
    </body>
    </html>
    `;
    
    return sendEmail(voluntario.email, subject, html);
}

// ========================================
// 6. ASIGNACIÓN A VOLUNTARIO
// ========================================
async function enviarNotificacionAsignacionVoluntario(voluntario, reporte) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nueva Asignación</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: #5D4037; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📋 ComuniSolve</h1>
                <p>Gestión Comunitaria Inteligente</p>
            </div>
            <div class="body">
                <h2>👥 ¡Te han asignado un reporte!</h2>
                <p><strong>Hola ${voluntario.nombre},</strong></p>
                <p>Se te ha asignado un reporte para atender:</p>
                <div class="info-box">
                    <p><strong>📌 Título:</strong> ${reporte.titulo}</p>
                    <p><strong>📍 Calle:</strong> ${reporte.nombre_calle}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/voluntarios/mi-perfil" class="btn">👤 Ver mi perfil</a>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
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
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo Voluntario</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: #5D4037; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #fd6704bd; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🆕 ComuniSolve</h1>
                <p>Gestión Comunitaria Inteligente</p>
            </div>
            <div class="body">
                <h2>🆕 ¡Nuevo voluntario registrado!</h2>
                <p><strong>Hola ${administrador.nombre},</strong></p>
                <p>Un nuevo ciudadano se ha postulado como voluntario:</p>
                <div class="info-box">
                    <p><strong>👤 Nombre:</strong> ${voluntario.nombre}</p>
                    <p><strong>🛠️ Habilidad:</strong> ${voluntario.habilidad}</p>
                    <p><strong>📞 Teléfono:</strong> ${voluntario.telefono || 'No especificado'}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/voluntarios/gestionar" class="btn">🤝 Gestionar</a>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
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
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo Usuario</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: #5D4037; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #fd6704bd; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🆕 ComuniSolve</h1>
                <p>Gestión Comunitaria Inteligente</p>
            </div>
            <div class="body">
                <h2>🆕 ¡Nuevo ciudadano registrado!</h2>
                <p><strong>Hola ${administrador.nombre},</strong></p>
                <p>Un nuevo ciudadano se ha registrado en el sistema:</p>
                <div class="info-box">
                    <p><strong>👤 Nombre:</strong> ${nuevoUsuario.nombre}</p>
                    <p><strong>📧 Email:</strong> ${nuevoUsuario.email}</p>
                    <p><strong>📍 Calle:</strong> ${nuevoUsuario.calle}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.APP_URL}/usuarios" class="btn">👤 Gestionar usuarios</a>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
            </div>
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
    const subject = estado === 'aprobado' ? '✅ ¡Tu cuenta ha sido aprobada!' : '📋 Actualización de tu cuenta';
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${estado === 'aprobado' ? 'Cuenta Aprobada' : 'Actualización de Cuenta'}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background: ${estado === 'aprobado' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'}; padding: 20px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
            .body { padding: 25px; color: #333; }
            .body h2 { color: ${estado === 'aprobado' ? '#28a745' : '#dc3545'}; margin-top: 0; }
            .btn { display: inline-block; padding: 12px 30px; background: ${estado === 'aprobado' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #fd6704bd 0%, #f7931e 100%)'}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
            .info-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid ${estado === 'aprobado' ? '#28a745' : '#dc3545'}; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>👤 ComuniSolve</h1>
                <p>${estado === 'aprobado' ? '¡Bienvenido a la comunidad!' : 'Actualización de tu cuenta'}</p>
            </div>
            <div class="body">
                ${estado === 'aprobado' ? `
                    <h2>✅ ¡Cuenta aprobada!</h2>
                    <p><strong>Hola ${usuario.nombre},</strong></p>
                    <p>Tu cuenta ha sido <strong style="color: #28a745;">APROBADA</strong>.</p>
                    <p>Ya puedes iniciar sesión en <strong>ComuniSolve</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL}/login" class="btn">🚀 Iniciar sesión</a>
                    </div>
                ` : `
                    <h2>📋 Actualización de tu cuenta</h2>
                    <p><strong>Hola ${usuario.nombre},</strong></p>
                    <p>Tu solicitud de registro ha sido <strong style="color: #dc3545;">RECHAZADA</strong>.</p>
                    ${motivo ? `<div class="info-box"><p><strong>📝 Motivo:</strong> ${motivo}</p></div>` : ''}
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL}/registro" class="btn">🔄 Volver a registrarse</a>
                    </div>
                `}
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ComuniSolve</p>
                <p style="font-size: 10px; color: #aaa;">Este es un correo automático. Por favor, no respondas a este mensaje.</p>
            </div>
        </div>
    </body>
    </html>
    `;
    return sendEmail(usuario.email, subject, html);
}

// ========================================
// 📌 EXPORTAR TODAS LAS FUNCIONES
// ========================================
module.exports = {
    enviarNotificacionNuevoReporte,
    enviarNotificacionCambioEstado,
    enviarNotificacionEmpresaAsignada,
    enviarNotificacionVoluntario,
    enviarCorreoRecuperacion,
    enviarNotificacionAsignacionVoluntario,
    enviarNotificacionNuevoVoluntario,
    enviarNotificacionNuevoUsuario,
    enviarNotificacionEstadoUsuario,
    sendEmail
};