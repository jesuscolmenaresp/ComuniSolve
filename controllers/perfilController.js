const db = require('../models/db');
const bcrypt = require('bcryptjs');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');

// ==========================
// 📌 MOSTRAR PERFIL DE USUARIO
// ==========================
exports.mostrarPerfil = async (req, res) => {
    const usuario = req.session.usuario;
    
    try {
        // Obtener datos completos del usuario
        const [userData] = await db.query(`
            SELECT u.*, r.nombre as rol_nombre,
                   c.nombre as calle_nombre
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
            LEFT JOIN calles c ON u.calle_id = c.id
            WHERE u.id = ?
        `, [usuario.id]);
        
        if (userData.length === 0) {
            return res.status(404).send('Usuario no encontrado');
        }
        
        const user = userData[0];
        
        // Estadísticas del usuario
        const [stats] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM reportes WHERE usuario_id = ?) as mis_reportes,
                (SELECT COUNT(*) FROM votos WHERE usuario_id = ?) as mis_votos,
                (SELECT COUNT(*) FROM voluntarios WHERE usuario_id = ? AND estado = 'aprobado') as soy_voluntario
        `, [usuario.id, usuario.id, usuario.id]);
        
        // Últimos reportes del usuario (hasta 5)
        const [ultimosReportes] = await db.query(`
            SELECT r.id, r.titulo, r.fecha, r.estado
            FROM reportes r
            WHERE r.usuario_id = ?
            ORDER BY r.fecha DESC
            LIMIT 5
        `, [usuario.id]);
        
        // Si es líder, obtener las calles que lidera
        let callesLideradas = [];
        if (user.rol_id === 2) {
            const [calles] = await db.query(`
                SELECT nombre FROM calles WHERE lider_id = ?
            `, [usuario.id]);
            callesLideradas = calles.map(c => c.nombre);
        }
        
        // Si es UBCH, obtener las comunidades que atiende
        let comunidadesAtiende = [];
        if (user.rol_id === 1) {
            const [comunidades] = await db.query(`
                SELECT c.nombre 
                FROM comunidades c
                INNER JOIN ubch_comunidades uc ON c.id = uc.comunidad_id
                WHERE uc.ubch_id = ?
            `, [usuario.id]);
            comunidadesAtiende = comunidades.map(c => c.nombre);
        }
        
        res.render('perfil/index', {
            usuario: req.session.usuario,
            user,
            stats: stats[0],
            ultimosReportes,
            callesLideradas,
            comunidadesAtiende,
            session: req.session
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar el perfil');
    }
};

// ==========================
// 📌 EDITAR PERFIL (mostrar formulario)
// ==========================
exports.editarPerfil = async (req, res) => {
    const usuario = req.session.usuario;
    
    try {
        const [userData] = await db.query(`
            SELECT u.*, c.nombre as calle_nombre
            FROM usuarios u
            LEFT JOIN calles c ON u.calle_id = c.id
            WHERE u.id = ?
        `, [usuario.id]);
        
        if (userData.length === 0) {
            return res.status(404).send('Usuario no encontrado');
        }
        
        // Obtener calles para el selector (solo para ciudadanos y jefes)
        const [calles] = await db.query('SELECT id, nombre FROM calles ORDER BY nombre');
        
        res.render('perfil/editar', {
            usuario: req.session.usuario,
            user: userData[0],
            calles,
            session: req.session
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar formulario de edición');
    }
};

// ==========================
// 📌 ACTUALIZAR PERFIL (con auditoría COMPLETA)
// ==========================
exports.actualizarPerfil = async (req, res) => {
    const usuario = req.session.usuario;
    const { nombre, telefono, cedula, calle_id } = req.body;
    
    try {
        // Obtener datos ANTERIORES del usuario
        const [datosAnteriores] = await db.query(`
            SELECT nombre, telefono, cedula, calle_id 
            FROM usuarios 
            WHERE id = ?
        `, [usuario.id]);
        
        if (datosAnteriores.length === 0) {
            req.session.error = 'Usuario no encontrado';
            return res.redirect('/perfil/editar');
        }
        
        const anterior = datosAnteriores[0];
        
        // Verificar si la cédula ya existe (para otro usuario)
        if (cedula && cedula.trim() !== '') {
            const [existente] = await db.query(
                'SELECT id FROM usuarios WHERE cedula = ? AND id != ?',
                [cedula, usuario.id]
            );
            if (existente.length > 0) {
                req.session.error = 'La cédula ya está registrada por otro usuario';
                return res.redirect('/perfil/editar');
            }
        }
        
        // Actualizar datos básicos (NO actualizamos calle_id, solo nombre, telefono, cedula)
        await db.query(
            `UPDATE usuarios 
             SET nombre = ?, telefono = ?, cedula = ?
             WHERE id = ?`,
            [nombre, telefono || null, cedula || null, usuario.id]
        );
        
        // Preparar datos nuevos para auditoría
        const datosNuevos = {
            nombre,
            telefono: telefono || null,
            cedula: cedula || null
        };
        
        // Registrar en auditoría SOLO si hubo cambios
        let huboCambios = false;
        const cambios = {};
        
        if (anterior.nombre !== nombre) {
            huboCambios = true;
            cambios.nombre = { anterior: anterior.nombre, nuevo: nombre };
        }
        if (anterior.telefono !== telefono) {
            huboCambios = true;
            cambios.telefono = { anterior: anterior.telefono || 'null', nuevo: telefono || 'null' };
        }
        if (anterior.cedula !== cedula) {
            huboCambios = true;
            cambios.cedula = { anterior: anterior.cedula || 'null', nuevo: cedula || 'null' };
        }
        
        if (huboCambios) {
            const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
            await registrarAuditoria(
                usuario,
                'EDITAR',
                'usuarios',
                usuario.id,
                { nombre: anterior.nombre, telefono: anterior.telefono, cedula: anterior.cedula },
                { nombre, telefono, cedula }
            );
        }
        
        // Actualizar sesión
        req.session.usuario.nombre = nombre;
        
        req.session.mensaje = 'Perfil actualizado exitosamente';
        res.redirect('/perfil');
        
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al actualizar perfil';
        res.redirect('/perfil/editar');
    }
};
// ==========================
// 📌 CAMBIAR CONTRASEÑA (mostrar formulario)
// ==========================
exports.cambiarPasswordForm = (req, res) => {
    res.render('perfil/cambiar-password', {
        usuario: req.session.usuario,
        session: req.session
    });
};

// ==========================
// 📌 CAMBIAR CONTRASEÑA (procesar)
// ==========================
exports.cambiarPassword = async (req, res) => {
    const usuario = req.session.usuario;
    const { password_actual, password_nueva, password_confirm } = req.body;
    
    try {
        // Verificar que las contraseñas nuevas coincidan
        if (password_nueva !== password_confirm) {
            req.session.error = 'Las contraseñas nuevas no coinciden';
            return res.redirect('/perfil/cambiar-password');
        }
        
        // Verificar longitud mínima
        if (password_nueva.length < 6) {
            req.session.error = 'La nueva contraseña debe tener al menos 6 caracteres';
            return res.redirect('/perfil/cambiar-password');
        }
        
        // Obtener contraseña actual del usuario
        const [userData] = await db.query(
            'SELECT password FROM usuarios WHERE id = ?',
            [usuario.id]
        );
        
        // Verificar contraseña actual
        const passwordValida = await bcrypt.compare(password_actual, userData[0].password);
        if (!passwordValida) {
            req.session.error = 'La contraseña actual es incorrecta';
            return res.redirect('/perfil/cambiar-password');
        }
        
        // Encriptar nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const nuevaPasswordHash = await bcrypt.hash(password_nueva, salt);
        
        // Actualizar contraseña
        await db.query(
            'UPDATE usuarios SET password = ? WHERE id = ?',
            [nuevaPasswordHash, usuario.id]
        );
        
        // Registrar en auditoría
        await registrarAuditoria(
            usuario,
            'EDITAR',
            'usuarios',
            usuario.id,
            null,
            { password: '***Cambiada***' }
        );
        
        req.session.mensaje = 'Contraseña cambiada exitosamente';
        res.redirect('/perfil');
        
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al cambiar la contraseña';
        res.redirect('/perfil/cambiar-password');
    }
};