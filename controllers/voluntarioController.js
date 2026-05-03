const db = require('../models/db');
const { 
    enviarNotificacionVoluntario,
    enviarNotificacionAsignacionVoluntario,
    enviarNotificacionNuevoVoluntario 
} = require('../services/emailService');

// ==========================
// 📌 LISTAR VOLUNTARIOS APROBADOS (PÚBLICO)
// ==========================
exports.listarVoluntariosPublicos = async (req, res) => {
    try {
        const [voluntarios] = await db.query(`
            SELECT v.nombre, v.telefono, v.habilidad, v.experiencia
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

// ==========================
// 📌 MOSTRAR FORMULARIO DE POSTULACIÓN
// ==========================
exports.mostrarFormulario = async (req, res) => {
    try {
        const [existente] = await db.query(
            'SELECT * FROM voluntarios WHERE usuario_id = ?',
            [req.session.usuario.id]
        );
        
        const esEdicion = req.path === '/editar';
        
        if (esEdicion && existente.length > 0) {
            return res.render('voluntarios/registro', { 
                usuario: req.session.usuario,
                yaSolicito: true,
                datosVoluntario: existente[0],
                session: req.session
            });
        }
        
        if (!esEdicion && existente.length > 0) {
            return res.redirect('/voluntarios/mi-perfil');
        }
        
        res.render('voluntarios/registro', { 
            usuario: req.session.usuario,
            yaSolicito: false,
            datosVoluntario: null,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar formulario');
    }
};

// ==========================
// 📌 GUARDAR/ACTUALIZAR POSTULACIÓN (OPTIMIZADO)
// ==========================
exports.guardarVoluntario = async (req, res) => {
    const { nombre, telefono, habilidad, experiencia, disponibilidad_horaria } = req.body;
    const usuarioId = req.session.usuario.id;
    let esNuevo = false;
    let voluntarioInfo = { nombre, habilidad, telefono: telefono || 'No especificado', fecha_solicitud: new Date() };

    try {
        const [existente] = await db.query(
            'SELECT id FROM voluntarios WHERE usuario_id = ?',
            [usuarioId]
        );
        
        if (existente.length > 0) {
            await db.query(
                `UPDATE voluntarios 
                 SET nombre = ?, telefono = ?, habilidad = ?, experiencia = ?, disponibilidad_horaria = ?
                 WHERE usuario_id = ?`,
                [nombre, telefono || null, habilidad, experiencia || null, disponibilidad_horaria || null, usuarioId]
            );
            req.session.mensaje = 'Tu perfil de voluntario ha sido actualizado';
        } else {
            esNuevo = true;
            await db.query(
                `INSERT INTO voluntarios 
                (nombre, telefono, habilidad, experiencia, disponibilidad_horaria, usuario_id, estado, fecha_solicitud) 
                VALUES (?, ?, ?, ?, ?, ?, 'pendiente', NOW())`,
                [nombre, telefono || null, habilidad, experiencia || null, disponibilidad_horaria || null, usuarioId]
            );
            req.session.mensaje = '¡Gracias por unirte! Tu solicitud está pendiente de aprobación.';
        }
        
        // ✅ NOTIFICACIÓN EN SEGUNDO PLANO SOLO SI ES NUEVO
        if (esNuevo) {
            setImmediate(async () => {
                try {
                    const [administradores] = await db.query(
                        'SELECT id, email, nombre FROM usuarios WHERE rol_id IN (1, 2)'
                    );
                    
                    for (const admin of administradores) {
                        if (admin.email) {
                            await enviarNotificacionNuevoVoluntario(admin, voluntarioInfo);
                        }
                    }
                } catch (err) {
                    console.error('Error enviando notificaciones de nuevo voluntario:', err);
                }
            });
        }
        
        res.redirect('/voluntarios/mi-perfil');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al registrar voluntario';
        res.redirect('/voluntarios');
    }
};

// ==========================
// 📌 VER MI PERFIL DE VOLUNTARIO
// ==========================
exports.miPerfil = async (req, res) => {
    try {
        const [voluntario] = await db.query(
            `SELECT v.*, u.email 
             FROM voluntarios v
             INNER JOIN usuarios u ON v.usuario_id = u.id
             WHERE v.usuario_id = ?`,
            [req.session.usuario.id]
        );
        
        const [asignaciones] = await db.query(`
            SELECT vr.*, r.titulo, r.descripcion, r.estado as reporte_estado, c.nombre as calle
            FROM voluntarios_reportes vr
            INNER JOIN reportes r ON vr.reporte_id = r.id
            INNER JOIN calles c ON r.calle_id = c.id
            WHERE vr.voluntario_id = ? AND vr.estado = 'pendiente'
            ORDER BY vr.fecha_asignacion DESC
        `, [voluntario[0]?.id]);
        
        const [asignacionesAceptadas] = await db.query(`
            SELECT vr.*, r.titulo, r.descripcion, r.estado as reporte_estado, c.nombre as calle
            FROM voluntarios_reportes vr
            INNER JOIN reportes r ON vr.reporte_id = r.id
            INNER JOIN calles c ON r.calle_id = c.id
            WHERE vr.voluntario_id = ? AND vr.estado = 'aceptado'
            ORDER BY vr.fecha_asignacion DESC
        `, [voluntario[0]?.id]);
        
        res.render('voluntarios/mi-perfil', { 
            voluntario: voluntario[0] || null,
            asignaciones,
            asignacionesAceptadas,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar perfil');
    }
};

// ==========================
// 📌 PÁGINA DE ÉXITO
// ==========================
exports.exito = async (req, res) => {
    const mensaje = req.session.mensaje;
    req.session.mensaje = null;
    res.render('voluntarios/exito', { mensaje, session: req.session });
};

// ==========================
// 📌 GESTIONAR SOLICITUDES (UBCH/Líder)
// ==========================
exports.gestionarSolicitudes = async (req, res) => {
    try {
        const [solicitudes] = await db.query(`
            SELECT v.*, u.email, u.telefono as usuario_telefono
            FROM voluntarios v
            INNER JOIN usuarios u ON v.usuario_id = u.id
            WHERE v.estado = 'pendiente'
            ORDER BY v.fecha_solicitud DESC
        `);
        
        const [aprobados] = await db.query(`
            SELECT v.*, u.email, u.telefono as usuario_telefono
            FROM voluntarios v
            INNER JOIN usuarios u ON v.usuario_id = u.id
            WHERE v.estado = 'aprobado'
            ORDER BY v.nombre ASC
        `);
        
        const [rechazados] = await db.query(`
            SELECT v.*, u.email, u.telefono as usuario_telefono
            FROM voluntarios v
            INNER JOIN usuarios u ON v.usuario_id = u.id
            WHERE v.estado = 'rechazado'
            ORDER BY v.fecha_respuesta DESC
        `);
        
        res.render('voluntarios/gestionar', { 
            solicitudes,
            aprobados,
            rechazados,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar solicitudes');
    }
};

// ==========================
// 📌 APROBAR VOLUNTARIO (OPTIMIZADO)
// ==========================
exports.aprobar = async (req, res) => {
    const { id } = req.params;
    const adminId = req.session.usuario.id;
    
    try {
        const [voluntario] = await db.query(`
            SELECT v.*, u.email 
            FROM voluntarios v
            INNER JOIN usuarios u ON v.usuario_id = u.id
            WHERE v.id = ?
        `, [id]);
        
        await db.query(
            `UPDATE voluntarios 
             SET estado = 'aprobado', 
                 fecha_respuesta = NOW(), 
                 respondido_por = ? 
             WHERE id = ?`,
            [adminId, id]
        );
        
        // ✅ NOTIFICACIÓN EN SEGUNDO PLANO
        if (voluntario.length > 0 && voluntario[0].email) {
            setImmediate(async () => {
                try {
                    await enviarNotificacionVoluntario(
                        { nombre: voluntario[0].nombre, email: voluntario[0].email },
                        'aprobado'
                    );
                } catch (err) {
                    console.error('Error enviando notificación de aprobación:', err);
                }
            });
        }
        
        req.session.mensaje = 'Voluntario aprobado exitosamente';
        res.redirect('/voluntarios/gestionar');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al aprobar voluntario';
        res.redirect('/voluntarios/gestionar');
    }
};

// ==========================
// 📌 RECHAZAR VOLUNTARIO (OPTIMIZADO)
// ==========================
exports.rechazar = async (req, res) => {
    const { id } = req.params;
    const adminId = req.session.usuario.id;
    const { motivo } = req.body;
    
    try {
        const [voluntario] = await db.query(`
            SELECT v.*, u.email 
            FROM voluntarios v
            INNER JOIN usuarios u ON v.usuario_id = u.id
            WHERE v.id = ?
        `, [id]);
        
        await db.query(
            `UPDATE voluntarios 
             SET estado = 'rechazado', 
                 fecha_respuesta = NOW(), 
                 respondido_por = ? 
             WHERE id = ?`,
            [adminId, id]
        );
        
        // ✅ NOTIFICACIÓN EN SEGUNDO PLANO
        if (voluntario.length > 0 && voluntario[0].email) {
            setImmediate(async () => {
                try {
                    await enviarNotificacionVoluntario(
                        { nombre: voluntario[0].nombre, email: voluntario[0].email },
                        'rechazado',
                        motivo || ''
                    );
                } catch (err) {
                    console.error('Error enviando notificación de rechazo:', err);
                }
            });
        }
        
        req.session.mensaje = 'Voluntario rechazado';
        res.redirect('/voluntarios/gestionar');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al rechazar voluntario';
        res.redirect('/voluntarios/gestionar');
    }
};

// ==========================
// 📌 RESPONDER A ASIGNACIÓN (Voluntario)
// ==========================
exports.responderAsignacion = async (req, res) => {
    const { id } = req.params;
    const { accion } = req.body;

    try {
        const [asignacion] = await db.query(`
            SELECT vr.*, r.titulo
            FROM voluntarios_reportes vr
            INNER JOIN reportes r ON vr.reporte_id = r.id
            WHERE vr.id = ?
        `, [id]);
        
        if (asignacion.length === 0) {
            req.session.error = 'Asignación no encontrada';
            return res.redirect('/voluntarios/mi-perfil');
        }
        
        await db.query(
            'UPDATE voluntarios_reportes SET estado = ?, fecha_respuesta = NOW() WHERE id = ?',
            [accion, id]
        );
        
        req.session.mensaje = accion === 'aceptado' 
            ? '¡Gracias por ayudar! Has aceptado ayudar con el reporte.' 
            : 'Has rechazado la asignación.';
        res.redirect('/voluntarios/mi-perfil');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al procesar la solicitud';
        res.redirect('/voluntarios/mi-perfil');
    }
};

// ==========================
// 📌 ASIGNAR VOLUNTARIO A REPORTE (OPTIMIZADO - SIN BLOQUEO)
// ==========================
exports.asignarVoluntarioReporte = async (req, res) => {
    const { reporte_id, voluntario_id } = req.body;

    try {
        // Verificar si ya existe
        const [existente] = await db.query(
            'SELECT id FROM voluntarios_reportes WHERE voluntario_id = ? AND reporte_id = ?',
            [voluntario_id, reporte_id]
        );
        
        if (existente.length > 0) {
            req.session.error = 'Este voluntario ya ha sido asignado a este reporte';
            return res.redirect('/reportes');
        }
        
        // Obtener datos ANTES de insertar (para la notificación)
        const [voluntarioData] = await db.query(
            `SELECT v.*, u.email, u.nombre 
             FROM voluntarios v 
             INNER JOIN usuarios u ON v.usuario_id = u.id 
             WHERE v.id = ?`,
            [voluntario_id]
        );
        
        const [reporteData] = await db.query(
            `SELECT r.titulo, r.descripcion, r.estado, c.nombre as nombre_calle 
             FROM reportes r 
             INNER JOIN calles c ON r.calle_id = c.id 
             WHERE r.id = ?`,
            [reporte_id]
        );
        
        // Insertar rápidamente
        await db.query(
            `INSERT INTO voluntarios_reportes (voluntario_id, reporte_id, estado) 
             VALUES (?, ?, 'pendiente')`,
            [voluntario_id, reporte_id]
        );
        
        // ✅ NOTIFICACIÓN EN SEGUNDO PLANO
        if (voluntarioData.length > 0 && voluntarioData[0].email && reporteData.length > 0) {
            setImmediate(async () => {
                try {
                    await enviarNotificacionAsignacionVoluntario(
                        { email: voluntarioData[0].email, nombre: voluntarioData[0].nombre },
                        { 
                            titulo: reporteData[0].titulo, 
                            descripcion: reporteData[0].descripcion, 
                            nombre_calle: reporteData[0].nombre_calle, 
                            estado: reporteData[0].estado 
                        }
                    );
                } catch (err) {
                    console.error('Error enviando notificación de asignación:', err);
                }
            });
        }
        
        req.session.mensaje = 'Voluntario asignado correctamente. Se le ha enviado una notificación.';
        res.redirect('/reportes');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al asignar voluntario';
        res.redirect('/reportes');
    }
};

// ==========================
// 📌 OBTENER VOLUNTARIOS APROBADOS (API)
// ==========================
exports.getVoluntariosAprobados = async (req, res) => {
    try {
        const [voluntarios] = await db.query(`
            SELECT v.id, v.nombre, v.habilidad, v.disponibilidad_horaria
            FROM voluntarios v
            WHERE v.estado = 'aprobado'
            ORDER BY v.nombre ASC
        `);
        res.json(voluntarios);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener voluntarios' });
    }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE EDICIÓN
// ==========================
exports.mostrarEdicion = async (req, res) => {
    try {
        const [voluntario] = await db.query(
            'SELECT * FROM voluntarios WHERE usuario_id = ?',
            [req.session.usuario.id]
        );
        
        if (voluntario.length === 0) {
            req.session.error = 'No eres voluntario. Regístrate primero.';
            return res.redirect('/voluntarios');
        }
        
        res.render('voluntarios/registro', { 
            usuario: req.session.usuario,
            yaSolicito: true,
            datosVoluntario: voluntario[0],
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar formulario de edición');
    }
};

// ==========================
// 📌 CAMBIAR ESTADO DE VOLUNTARIO (UBCH/Líder)
// ==========================
exports.cambiarEstadoVoluntario = async (req, res) => {
    const { id } = req.params;
    const { nuevo_estado } = req.body;
    const usuario = req.session.usuario;

    try {
        const [voluntarioAntes] = await db.query(
            'SELECT estado, nombre, usuario_id FROM voluntarios WHERE id = ?',
            [id]
        );
        
        if (voluntarioAntes.length === 0) {
            req.session.error = 'Voluntario no encontrado';
            return res.redirect('/voluntarios/gestionar');
        }
        
        await db.query(
            'UPDATE voluntarios SET estado = ?, fecha_respuesta = NOW(), respondido_por = ? WHERE id = ?',
            [nuevo_estado, usuario.id, id]
        );
        
        const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
        await registrarAuditoria(
            usuario,
            'EDITAR',
            'voluntarios',
            id,
            { estado: voluntarioAntes[0].estado },
            { estado: nuevo_estado }
        );
        
        // ✅ NOTIFICACIÓN EN SEGUNDO PLANO SI CAMBIA A APROBADO/RECHAZADO
        if (nuevo_estado !== voluntarioAntes[0].estado && (nuevo_estado === 'aprobado' || nuevo_estado === 'rechazado')) {
            setImmediate(async () => {
                try {
                    const [usuarioVoluntario] = await db.query(
                        'SELECT email, nombre FROM usuarios WHERE id = ?',
                        [voluntarioAntes[0].usuario_id]
                    );
                    if (usuarioVoluntario.length > 0 && usuarioVoluntario[0].email) {
                        await enviarNotificacionVoluntario(
                            { nombre: voluntarioAntes[0].nombre, email: usuarioVoluntario[0].email },
                            nuevo_estado
                        );
                    }
                } catch (err) {
                    console.error('Error enviando notificación de cambio de estado:', err);
                }
            });
        }
        
        req.session.mensaje = `Voluntario ${voluntarioAntes[0].nombre} ha sido ${nuevo_estado === 'aprobado' ? 'APROBADO' : 'RECHAZADO'}`;
        res.redirect('/voluntarios/gestionar');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al cambiar estado del voluntario';
        res.redirect('/voluntarios/gestionar');
    }
};