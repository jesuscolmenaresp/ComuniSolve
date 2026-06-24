const db = require('../models/db');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');

// ==========================
// 📌 LISTAR NOTIFICACIONES
// ==========================
exports.listar = async (req, res) => {
    const usuario = req.session.usuario;
    
    try {
        // Obtener notificaciones activas
        const [notificaciones] = await db.query(`
            SELECT n.*, u.nombre as creador_nombre,
                   (SELECT COUNT(*) FROM notificaciones_leidas nl WHERE nl.notificacion_id = n.id AND nl.usuario_id = ?) as leida
            FROM notificaciones n
            INNER JOIN usuarios u ON n.creado_por = u.id
            WHERE n.activo = 1
            ORDER BY n.fecha_creacion DESC
            LIMIT 50
        `, [usuario.id]);
        
        // Contar no leídas
        const [noLeidas] = await db.query(`
            SELECT COUNT(*) as total FROM notificaciones n
            WHERE n.activo = 1
            AND NOT EXISTS (
                SELECT 1 FROM notificaciones_leidas nl 
                WHERE nl.notificacion_id = n.id AND nl.usuario_id = ?
            )
        `, [usuario.id]);
        
        res.render('notificaciones/index', {
            notificaciones,
            noLeidas: noLeidas[0].total,
            usuario,
            session: req.session
        });
    } catch (err) {
        console.error('Error al listar notificaciones:', err);
        res.status(500).send('Error al cargar notificaciones');
    }
};

// ==========================
// 📌 CREAR NOTIFICACIÓN (solo UBCH y SuperAdmin)
// ==========================
exports.crear = async (req, res) => {
    const { titulo, contenido, tipo, prioridad } = req.body;
    const usuario = req.session.usuario;
    
    try {
        if (!usuario || ![1, 5].includes(usuario.rol_id)) {
            req.session.error = 'No autorizado';
            return res.redirect('/notificaciones');
        }
        
        await db.query(
            `INSERT INTO notificaciones (titulo, contenido, tipo, prioridad, creado_por) 
             VALUES (?, ?, ?, ?, ?)`,
            [titulo, contenido, tipo || 'general', prioridad || 'media', usuario.id]
        );
        
        await registrarAuditoria(
            usuario,
            'CREAR',
            'notificaciones',
            null,
            null,
            { titulo, contenido, tipo, prioridad }
        );
        
        req.session.mensaje = 'Notificación creada exitosamente';
        res.redirect('/notificaciones');
    } catch (err) {
        console.error('Error al crear notificación:', err);
        req.session.error = 'Error al crear notificación';
        res.redirect('/notificaciones');
    }
};

// ==========================
// 📌 MARCAR COMO LEÍDA
// ==========================
exports.marcarLeida = async (req, res) => {
    const { id } = req.params;
    const usuario = req.session.usuario;
    
    try {
        await db.query(
            `INSERT IGNORE INTO notificaciones_leidas (notificacion_id, usuario_id, fecha_leida) 
             VALUES (?, ?, NOW())`,
            [id, usuario.id]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error al marcar leída:', err);
        res.json({ success: false });
    }
};

// ==========================
// 📌 MARCAR TODAS COMO LEÍDAS
// ==========================
exports.marcarTodasLeidas = async (req, res) => {
    const usuario = req.session.usuario;
    
    try {
        await db.query(
            `INSERT IGNORE INTO notificaciones_leidas (notificacion_id, usuario_id, fecha_leida)
             SELECT id, ?, NOW() FROM notificaciones WHERE activo = 1
             AND NOT EXISTS (
                 SELECT 1 FROM notificaciones_leidas nl 
                 WHERE nl.notificacion_id = notificaciones.id AND nl.usuario_id = ?
             )`,
            [usuario.id, usuario.id]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error al marcar todas leídas:', err);
        res.json({ success: false });
    }
};

// ==========================
// 📌 ELIMINAR NOTIFICACIÓN (solo creador o SuperAdmin)
// ==========================
exports.eliminar = async (req, res) => {
    const { id } = req.params;
    const usuario = req.session.usuario;
    
    try {
        const [notificacion] = await db.query(
            'SELECT creado_por, titulo FROM notificaciones WHERE id = ?',
            [id]
        );
        
        if (notificacion.length === 0) {
            req.session.error = 'Notificación no encontrada';
            return res.redirect('/notificaciones');
        }
        
        if (notificacion[0].creado_por !== usuario.id && usuario.rol_id !== 5) {
            req.session.error = 'No autorizado';
            return res.redirect('/notificaciones');
        }
        
        await db.query('UPDATE notificaciones SET activo = 0 WHERE id = ?', [id]);
        
        await registrarAuditoria(
            usuario,
            'ELIMINAR',
            'notificaciones',
            id,
            { titulo: notificacion[0].titulo },
            { activo: false }
        );
        
        req.session.mensaje = 'Notificación eliminada';
        res.redirect('/notificaciones');
    } catch (err) {
        console.error('Error al eliminar notificación:', err);
        req.session.error = 'Error al eliminar notificación';
        res.redirect('/notificaciones');
    }
};

// ==========================
// 📌 OBTENER CONTADOR DE NO LEÍDAS (API)
// ==========================
exports.contarNoLeidas = async (req, res) => {
    const usuario = req.session.usuario;
    
    try {
        if (!usuario) {
            return res.json({ total: 0 });
        }
        
        const [result] = await db.query(`
            SELECT COUNT(*) as total FROM notificaciones n
            WHERE n.activo = 1
            AND NOT EXISTS (
                SELECT 1 FROM notificaciones_leidas nl 
                WHERE nl.notificacion_id = n.id AND nl.usuario_id = ?
            )
        `, [usuario.id]);
        
        res.json({ total: result[0].total });
    } catch (err) {
        console.error('Error al contar no leídas:', err);
        res.json({ total: 0 });
    }
};