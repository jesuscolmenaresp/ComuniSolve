const db = require('../models/db');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');

// ==========================
// 📌 LISTAR CATEGORÍAS ACTIVAS
// ==========================
exports.listar = async (req, res) => {
    try {
        const [categorias] = await db.query(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM reportes WHERE categoria_id = c.id AND activo = 1) as total_reportes
            FROM categorias c
            WHERE c.activo = 1
            ORDER BY c.nombre
        `);
        
        res.render('categorias/listar', { 
            categorias,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al listar categorías');
    }
};

// ==========================
// 📌 LISTAR CATEGORÍAS INACTIVAS
// ==========================
exports.listarInactivas = async (req, res) => {
    try {
        // Verificar que sea UBCH o SuperAdmin
        if (!req.session.usuario || (req.session.usuario.rol_id !== 1 && req.session.usuario.rol_id !== 5)) {
            req.session.error = 'No autorizado';
            return res.redirect('/dashboard');
        }

        const [categorias] = await db.query(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM reportes WHERE categoria_id = c.id) as total_reportes
            FROM categorias c
            WHERE c.activo = 0
            ORDER BY c.nombre
        `);
        
        res.render('categorias/inactivos', { 
            categorias,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al listar categorías inactivas';
        res.redirect('/categorias');
    }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE NUEVA CATEGORÍA
// ==========================
exports.formCrear = (req, res) => {
    res.render('categorias/crear', { 
        usuario: req.session.usuario,
        session: req.session
    });
};

// ==========================
// 📌 GUARDAR NUEVA CATEGORÍA
// ==========================
exports.crear = async (req, res) => {
    const { nombre, descripcion, icono, color } = req.body;
    
    try {
        const [result] = await db.query(
            'INSERT INTO categorias (nombre, descripcion, icono, color, activo) VALUES (?, ?, ?, ?, 1)',
            [nombre, descripcion || null, icono || null, color || 'secondary']
        );
        
        await registrarAuditoria(
            req.session.usuario,
            'CREAR',
            'categorias',
            result.insertId,
            null,
            { nombre, descripcion, icono, color }
        );
        
        req.session.mensaje = 'Categoría creada exitosamente';
        res.redirect('/categorias');
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            req.session.error = 'Ya existe una categoría con ese nombre';
        } else {
            req.session.error = 'Error al crear categoría';
        }
        res.redirect('/categorias/nueva');
    }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE EDICIÓN
// ==========================
exports.formEditar = async (req, res) => {
    const { id } = req.params;
    
    try {
        const [categoria] = await db.query('SELECT * FROM categorias WHERE id = ? AND activo = 1', [id]);
        if (categoria.length === 0) {
            return res.status(404).send('Categoría no encontrada');
        }
        
        res.render('categorias/editar', { 
            categoria: categoria[0],
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar formulario');
    }
};

// ==========================
// 📌 ACTUALIZAR CATEGORÍA
// ==========================
exports.actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, icono, color } = req.body;
    
    try {
        const [categoriaAnterior] = await db.query('SELECT * FROM categorias WHERE id = ?', [id]);
        
        await db.query(
            'UPDATE categorias SET nombre = ?, descripcion = ?, icono = ?, color = ? WHERE id = ?',
            [nombre, descripcion || null, icono || null, color || 'secondary', id]
        );
        
        await registrarAuditoria(
            req.session.usuario,
            'EDITAR',
            'categorias',
            id,
            categoriaAnterior[0],
            { nombre, descripcion, icono, color }
        );
        
        req.session.mensaje = 'Categoría actualizada exitosamente';
        res.redirect('/categorias');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al actualizar categoría';
        res.redirect(`/categorias/${id}/editar`);
    }
};

// ==========================
// 📌 DESACTIVAR CATEGORÍA (SOFT DELETE)
// ==========================
exports.desactivar = async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    try {
        const [categoriaADesactivar] = await db.query(
            'SELECT nombre FROM categorias WHERE id = ? AND activo = 1',
            [id]
        );

        if (categoriaADesactivar.length === 0) {
            req.session.error = 'Categoría no encontrada o ya está inactiva';
            return res.redirect('/categorias');
        }

        // Verificar si tiene reportes asociados
        const [reportesAsociados] = await db.query(
            'SELECT COUNT(*) as total FROM reportes WHERE categoria_id = ? AND activo = 1',
            [id]
        );

        if (reportesAsociados[0].total > 0) {
            req.session.error = `No se puede desactivar la categoría porque tiene ${reportesAsociados[0].total} reportes asociados.`;
            return res.redirect('/categorias');
        }

        await db.query('UPDATE categorias SET activo = 0 WHERE id = ?', [id]);

        await registrarAuditoria(
            req.session.usuario,
            'DESACTIVAR',
            'categorias',
            id,
            categoriaADesactivar[0],
            { motivo: motivo || 'Desactivado por administrador', activo: false }
        );

        req.session.mensaje = `Categoría "${categoriaADesactivar[0].nombre}" desactivada correctamente`;
        res.redirect('/categorias');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al desactivar categoría';
        res.redirect('/categorias');
    }
};

// ==========================
// 📌 ACTIVAR CATEGORÍA (REACTIVAR)
// ==========================
exports.activar = async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    try {
        const [categoriaAActivar] = await db.query(
            'SELECT nombre FROM categorias WHERE id = ? AND activo = 0',
            [id]
        );

        if (categoriaAActivar.length === 0) {
            req.session.error = 'Categoría no encontrada o ya está activa';
            return res.redirect('/categorias/inactivos');
        }

        await db.query('UPDATE categorias SET activo = 1 WHERE id = ?', [id]);

        await registrarAuditoria(
            req.session.usuario,
            'ACTIVAR',
            'categorias',
            id,
            { activo: false },
            { motivo: motivo || 'Reactivado por administrador', activo: true }
        );

        req.session.mensaje = `Categoría "${categoriaAActivar[0].nombre}" activada correctamente`;
        res.redirect('/categorias/inactivos');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al activar categoría';
        res.redirect('/categorias/inactivos');
    }
};

// ==========================
// 📌 ELIMINAR FÍSICAMENTE (SOLO SUPERADMIN CON MOTIVO)
// ==========================
exports.destruir = async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    try {
        if (!req.session.usuario || req.session.usuario.rol_id !== 5) {
            req.session.error = 'No autorizado';
            return res.redirect('/categorias/inactivos');
        }

        if (!motivo || motivo.trim() === '') {
            req.session.error = 'Debe especificar un motivo para eliminar permanentemente la categoría';
            return res.redirect('/categorias/inactivos');
        }

        const [categoriaAEliminar] = await db.query(
            'SELECT nombre, id FROM categorias WHERE id = ?',
            [id]
        );

        if (categoriaAEliminar.length === 0) {
            req.session.error = 'Categoría no encontrada';
            return res.redirect('/categorias/inactivos');
        }

        // Verificar si tiene reportes asociados (incluso inactivos)
        const [reportesAsociados] = await db.query(
            'SELECT COUNT(*) as total FROM reportes WHERE categoria_id = ?',
            [id]
        );

        if (reportesAsociados[0].total > 0) {
            req.session.error = `No se puede eliminar la categoría porque tiene ${reportesAsociados[0].total} reportes asociados.`;
            return res.redirect('/categorias/inactivos');
        }

        const datosCategoria = categoriaAEliminar[0];
        const datosConMotivo = {
            ...datosCategoria,
            motivo_eliminacion: motivo.trim(),
            eliminado_por: req.session.usuario.nombre,
            fecha_eliminacion: new Date().toLocaleString()
        };

        await db.query('DELETE FROM categorias WHERE id = ?', [id]);

        await registrarAuditoria(
            req.session.usuario,
            'ELIMINAR_PERMANENTEMENTE',
            'categorias',
            id,
            datosConMotivo,
            { motivo: motivo.trim(), eliminado_por: req.session.usuario.nombre },
            req
        );

        req.session.mensaje = `Categoría "${datosCategoria.nombre}" eliminada permanentemente. Motivo: ${motivo}`;
        res.redirect('/categorias/inactivos');
    } catch (err) {
        console.error('Error en destruir:', err);
        req.session.error = 'Error al eliminar categoría permanentemente';
        res.redirect('/categorias/inactivos');
    }
};

// ==========================
// 📌 OBTENER TODAS LAS CATEGORÍAS (API)
// ==========================
exports.getCategorias = async (req, res) => {
    try {
        const [categorias] = await db.query('SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre');
        res.json(categorias);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};