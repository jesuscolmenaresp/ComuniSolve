const db = require('../models/db');

// 📌 Listar registros de auditoría
exports.listar = async (req, res) => {
    try {
        const [registros] = await db.query(`
            SELECT a.*, u.nombre as usuario_nombre
            FROM auditoria a
            INNER JOIN usuarios u ON a.usuario_id = u.id
            ORDER BY a.fecha DESC
            LIMIT 100
        `);
        
        res.render('auditoria/listar', { 
            registros,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al listar auditoría');
    }
};

// 📌 Obtener detalles de un registro
exports.detalle = async (req, res) => {
    const { id } = req.params;
    
    try {
        const [registro] = await db.query(`
            SELECT a.*, u.nombre as usuario_nombre
            FROM auditoria a
            INNER JOIN usuarios u ON a.usuario_id = u.id
            WHERE a.id = ?
        `, [id]);
        
        if (registro.length === 0) {
            return res.status(404).send('Registro no encontrado');
        }
        
        res.json(registro[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener detalle' });
    }
};

// 📌 Limpiar registros antiguos (solo UBCH)
exports.limpiar = async (req, res) => {
    const { dias } = req.body;
    const diasLimpiar = dias || 90; // Por defecto 90 días
    
    try {
        const [result] = await db.query(
            'DELETE FROM auditoria WHERE fecha < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [diasLimpiar]
        );
        
        req.session.mensaje = `Se eliminaron ${result.affectedRows} registros antiguos`;
        res.redirect('/auditoria');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al limpiar auditoría';
        res.redirect('/auditoria');
    }
};