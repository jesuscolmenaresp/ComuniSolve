const db = require('../models/db');

// 📌 Mostrar formulario para ser voluntario
exports.mostrarFormulario = async (req, res) => {
    try {
        // Verificar si ya tiene una solicitud pendiente
        const [existente] = await db.query(
            'SELECT estado FROM voluntarios WHERE usuario_id = ?',
            [req.session.usuario.id]
        );
        
        let yaSolicito = existente.length > 0;
        let estadoSolicitud = existente[0]?.estado;
        
        res.render('voluntarios/registro', { 
            usuario: req.session.usuario,
            yaSolicito,
            estadoSolicitud,
            session: req.session  // 👈 IMPORTANTE: pasar la sesión
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar formulario');
    }
};

// 📌 Guardar registro de voluntario
exports.guardarVoluntario = async (req, res) => {
    const { nombre, telefono, habilidad } = req.body;
    const usuarioId = req.session.usuario.id;

    try {
        // Verificar si ya tiene una solicitud
        const [existente] = await db.query(
            'SELECT id FROM voluntarios WHERE usuario_id = ?',
            [usuarioId]
        );
        
        if (existente.length > 0) {
            req.session.error = 'Ya tienes una solicitud de voluntario registrada';
            return res.redirect('/voluntarios');
        }

        await db.query(
            `INSERT INTO voluntarios 
            (nombre, telefono, habilidad, usuario_id, estado, fecha_solicitud) 
            VALUES (?, ?, ?, ?, 'pendiente', NOW())`,
            [nombre, telefono || null, habilidad, usuarioId]
        );
        
        req.session.mensaje = '¡Gracias por unirte! Tu solicitud está pendiente de aprobación.';
        res.redirect('/voluntarios/exito');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al registrar voluntario';
        res.redirect('/voluntarios');
    }
};

// 📌 Página de éxito
exports.exito = async (req, res) => {
    const mensaje = req.session.mensaje;
    req.session.mensaje = null;
    res.render('voluntarios/exito', { mensaje });
};

// 📌 Listar voluntarios (solo aprobados para vista pública)
exports.listarVoluntariosPublicos = async (req, res) => {
    try {
        const [voluntarios] = await db.query(`
            SELECT v.nombre, v.telefono, v.habilidad 
            FROM voluntarios v
            WHERE v.estado = 'aprobado'
            ORDER BY v.id DESC
        `);
        
        res.render('voluntarios/publico', { 
            voluntarios,
            usuario: req.session.usuario 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al listar voluntarios');
    }
};

// 📌 Gestionar solicitudes (para UBCH y líderes)
exports.gestionarSolicitudes = async (req, res) => {
    try {
        const [solicitudes] = await db.query(`
            SELECT v.*, u.email, u.telefono as usuario_telefono
            FROM voluntarios v
            INNER JOIN usuarios u ON v.usuario_id = u.id
            ORDER BY 
                CASE v.estado
                    WHEN 'pendiente' THEN 1
                    WHEN 'aprobado' THEN 2
                    WHEN 'rechazado' THEN 3
                END,
                v.fecha_solicitud DESC
        `);
        
        res.render('voluntarios/gestionar', { 
            solicitudes,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar solicitudes');
    }
};

// 📌 Aprobar voluntario
exports.aprobar = async (req, res) => {
    const { id } = req.params;
    const adminId = req.session.usuario.id;
    
    try {
        await db.query(
            `UPDATE voluntarios 
             SET estado = 'aprobado', 
                 fecha_respuesta = NOW(), 
                 respondido_por = ? 
             WHERE id = ?`,
            [adminId, id]
        );
        
        req.session.mensaje = 'Voluntario aprobado exitosamente';
        res.redirect('/voluntarios/gestionar');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al aprobar voluntario';
        res.redirect('/voluntarios/gestionar');
    }
};

// 📌 Rechazar voluntario
exports.rechazar = async (req, res) => {
    const { id } = req.params;
    const adminId = req.session.usuario.id;
    
    try {
        await db.query(
            `UPDATE voluntarios 
             SET estado = 'rechazado', 
                 fecha_respuesta = NOW(), 
                 respondido_por = ? 
             WHERE id = ?`,
            [adminId, id]
        );
        
        req.session.mensaje = 'Voluntario rechazado';
        res.redirect('/voluntarios/gestionar');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al rechazar voluntario';
        res.redirect('/voluntarios/gestionar');
    }
};

// 📌 Listar voluntarios (solo aprobados para vista pública)
exports.listarVoluntariosPublicos = async (req, res) => {
    try {
        const [voluntarios] = await db.query(`
            SELECT v.nombre, v.telefono, v.habilidad 
            FROM voluntarios v
            WHERE v.estado = 'aprobado'
            ORDER BY v.nombre ASC
        `);
        
        res.render('voluntarios/publico', { 
            voluntarios,
            usuario: req.session?.usuario || null,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al listar voluntarios');
    }
};