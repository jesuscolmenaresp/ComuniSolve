const db = require('../models/db');

// Función para registrar acciones
async function registrarAuditoria(usuario, accion, tabla, registroId, datosAnteriores = null, datosNuevos = null) {
    try {
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
                null, // Se puede obtener con req.ip
                null  // Se puede obtener con req.headers['user-agent']
            ]
        );
    } catch (err) {
        console.error('Error al registrar auditoría:', err);
    }
}

module.exports = {
    registrarAuditoria
};