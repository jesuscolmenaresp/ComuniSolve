const db = require('../models/db');

// 📌 Listar registros de auditoría
exports.listar = async (req, res) => {
    try {
        // Obtener filtros de la query string
        const { usuario, accion, tabla, fecha_desde, fecha_hasta } = req.query;
        
        let query = `
            SELECT a.*, u.nombre as usuario_nombre
            FROM auditoria a
            INNER JOIN usuarios u ON a.usuario_id = u.id
            WHERE 1=1
        `;
        let params = [];
        
        // Aplicar filtros
        if (usuario && usuario !== '') {
            query += " AND u.nombre LIKE ?";
            params.push(`%${usuario}%`);
        }
        if (accion && accion !== 'todos') {
            query += " AND a.accion = ?";
            params.push(accion);
        }
        if (tabla && tabla !== 'todos') {
            query += " AND a.tabla = ?";
            params.push(tabla);
        }
        if (fecha_desde) {
            query += " AND DATE(a.fecha) >= ?";
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            query += " AND DATE(a.fecha) <= ?";
            params.push(fecha_hasta);
        }
        
        query += " ORDER BY a.fecha DESC LIMIT 100";
        
        const [registros] = await db.query(query, params);
        
        res.render('auditoria/listar', { 
            registros,
            usuario: req.session.usuario,
            session: req.session,
            filters: { usuario, accion, tabla, fecha_desde, fecha_hasta }  // 👈 PASAR FILTROS
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
            return res.status(404).json({ error: 'Registro no encontrado' });
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
    const diasLimpiar = dias || 90;
    
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