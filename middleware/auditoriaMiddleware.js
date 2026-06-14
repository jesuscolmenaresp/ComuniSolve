const db = require('../models/db');

// Función para registrar acciones (con IP y User-Agent)
async function registrarAuditoria(usuario, accion, tabla, registroId, datosAnteriores = null, datosNuevos = null, req = null) {
    try {
        let ipAddress = null;
        let userAgent = null;
        
        if (req) {
            ipAddress = req.ip || req.connection?.remoteAddress || null;
            // Limpiar IPv6 localhost para que se vea mejor
            if (ipAddress === '::1') ipAddress = '127.0.0.1';
            userAgent = req.headers['user-agent'] || null;
        }
        
        await db.query(
            `INSERT INTO auditoria 
             (usuario_id, usuario_nombre, usuario_email, accion, tabla, registro_id, datos_anteriores, datos_nuevos, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                usuario.id,
                usuario.nombre,
                usuario.email,
                accion,
                tabla,
                registroId,
                datosAnteriores ? JSON.stringify(datosAnteriores) : null,
                datosNuevos ? JSON.stringify(datosNuevos) : null,
                ipAddress,
                userAgent
            ]
        );
    } catch (err) {
        console.error('Error al registrar auditoría:', err);
    }
}

module.exports = {
    registrarAuditoria
}