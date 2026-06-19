const db = require('../models/db');
const bcrypt = require('bcryptjs');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
const { procesarFotoPerfil } = require('../middleware/imageProcessor');
const fs = require('fs');
const path = require('path');

console.log('✅ perfilController cargado correctamente');

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
        
        res.render('perfil/editar', {
            usuario: req.session.usuario,
            user: userData[0],
            session: req.session
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar formulario de edición');
    }
};

// ==========================
// 📌 ACTUALIZAR PERFIL CON FOTO
// ==========================
exports.actualizarPerfil = async (req, res) => {
    const usuario = req.session.usuario;
    const { nombre, telefono, cedula } = req.body;
    let fotoPerfil = null;
    
    try {
        // Obtener datos ANTERIORES del usuario
        const [datosAnteriores] = await db.query(`
            SELECT nombre, telefono, cedula, foto_perfil
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
        
        // Procesar foto de perfil si se subió
        if (req.file) {
            fotoPerfil = '/uploads/perfiles/' + req.file.filename;
            
            // Eliminar foto anterior si existe
            if (anterior.foto_perfil) {
                const oldPath = path.join(__dirname, '../public', anterior.foto_perfil);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            
            // Procesar la imagen con sharp (cuadrado, 200x200)
            try {
                await procesarFotoPerfil(req.file.path);
            } catch (err) {
                console.error('Error al procesar imagen:', err);
            }
        }
        
        // Construir query de actualización
        let query = 'UPDATE usuarios SET nombre = ?, telefono = ?, cedula = ?';
        let params = [nombre, telefono || null, cedula || null];
        
        if (fotoPerfil) {
            query += ', foto_perfil = ?';
            params.push(fotoPerfil);
        }
        
        query += ' WHERE id = ?';
        params.push(usuario.id);
        
        await db.query(query, params);
        
        // Registrar en auditoría
        await registrarAuditoria(
            usuario,
            'EDITAR',
            'usuarios',
            usuario.id,
            { nombre: anterior.nombre, telefono: anterior.telefono, cedula: anterior.cedula },
            { nombre, telefono: telefono || null, cedula: cedula || null, foto: fotoPerfil || 'sin cambios' }
        );
        
        // Actualizar sesión
        req.session.usuario.nombre = nombre;
        if (fotoPerfil) {
            req.session.usuario.foto_perfil = fotoPerfil;
        }
        
        req.session.mensaje = 'Perfil actualizado exitosamente';
        res.redirect('/perfil');
        
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al actualizar perfil';
        res.redirect('/perfil/editar');
    }
};

// ==========================
// 📌 CAMBIAR CONTRASEÑA (formulario)
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
        if (password_nueva !== password_confirm) {
            req.session.error = 'Las contraseñas nuevas no coinciden';
            return res.redirect('/perfil/cambiar-password');
        }
        
        if (password_nueva.length < 6) {
            req.session.error = 'La nueva contraseña debe tener al menos 6 caracteres';
            return res.redirect('/perfil/cambiar-password');
        }
        
        const [userData] = await db.query(
            'SELECT password FROM usuarios WHERE id = ?',
            [usuario.id]
        );
        
        const passwordValida = await bcrypt.compare(password_actual, userData[0].password);
        if (!passwordValida) {
            req.session.error = 'La contraseña actual es incorrecta';
            return res.redirect('/perfil/cambiar-password');
        }
        
        const salt = await bcrypt.genSalt(10);
        const nuevaPasswordHash = await bcrypt.hash(password_nueva, salt);
        
        await db.query(
            'UPDATE usuarios SET password = ? WHERE id = ?',
            [nuevaPasswordHash, usuario.id]
        );
        
        await registrarAuditoria(
            usuario,
            'EDITAR',
            'usuarios',
            usuario.id,
            null,
            { password: '***Cambiada***' }
        );
        
        // ✅ Guardar mensaje de éxito en la sesión
        req.session.mensaje = '🔐 Contraseña cambiada exitosamente';
        res.redirect('/perfil');
        
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al cambiar la contraseña';
        res.redirect('/perfil/cambiar-password');
    }
};

// ==========================
// 📌 ELIMINAR FOTO DE PERFIL
// ==========================
exports.eliminarFoto = async (req, res) => {
    const usuario = req.session.usuario;
    
    try {
        const [userData] = await db.query(
            'SELECT foto_perfil FROM usuarios WHERE id = ?',
            [usuario.id]
        );
        
        if (userData.length > 0 && userData[0].foto_perfil) {
            const oldPath = path.join(__dirname, '../public', userData[0].foto_perfil);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
            
            await db.query(
                'UPDATE usuarios SET foto_perfil = NULL WHERE id = ?',
                [usuario.id]
            );
            
            delete req.session.usuario.foto_perfil;
            
            await registrarAuditoria(
                usuario,
                'EDITAR',
                'usuarios',
                usuario.id,
                { foto_perfil: userData[0].foto_perfil },
                { foto_perfil: null }
            );
            
            req.session.mensaje = 'Foto de perfil eliminada';
        } else {
            req.session.mensaje = 'No tenías foto de perfil';
        }
        
        res.redirect('/perfil');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al eliminar la foto';
        res.redirect('/perfil');
    }
};