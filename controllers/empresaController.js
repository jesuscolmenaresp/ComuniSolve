const db = require('../models/db');
const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');

// ==========================
// 📌 LISTAR EMPRESAS ACTIVAS
// ==========================
exports.listar = async (req, res) => {
    try {
        const [empresas] = await db.query(`
            SELECT e.*, 
                   GROUP_CONCAT(c.nombre) as categorias_nombres
            FROM empresas e
            LEFT JOIN empresa_categorias ec ON e.id = ec.empresa_id
            LEFT JOIN categorias c ON ec.categoria_id = c.id
            WHERE e.activo = 1
            GROUP BY e.id
            ORDER BY e.nombre
        `);
        
        // ====== OBTENER CATEGORÍAS PARA FILTROS ======
        const [categorias] = await db.query(
            "SELECT id, nombre FROM categorias WHERE activo = 1 ORDER BY nombre"
        );
        
        res.render('empresas/listar', { 
            empresas,
            categorias,  // ← Para el filtro por categoría
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al listar empresas');
    }
};
// ==========================
// 📌 LISTAR EMPRESAS INACTIVAS
// ==========================
exports.listarInactivas = async (req, res) => {
    try {
        if (!req.session.usuario || (req.session.usuario.rol_id !== 1 && req.session.usuario.rol_id !== 5)) {
            req.session.error = 'No autorizado';
            return res.redirect('/dashboard');
        }

        const [empresas] = await db.query(`
            SELECT e.*, 
                   GROUP_CONCAT(c.nombre) as categorias_nombres
            FROM empresas e
            LEFT JOIN empresa_categorias ec ON e.id = ec.empresa_id
            LEFT JOIN categorias c ON ec.categoria_id = c.id
            WHERE e.activo = 0
            GROUP BY e.id
            ORDER BY e.nombre
        `);
        
        res.render('empresas/inactivos', { 
            empresas,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al listar empresas inactivas';
        res.redirect('/empresas');
    }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE NUEVA EMPRESA
// ==========================
exports.formCrear = async (req, res) => {
    try {
        const [categorias] = await db.query("SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre");
        
        res.render('empresas/crear', { 
            categorias,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar formulario');
    }
};

// ==========================
// 📌 GUARDAR NUEVA EMPRESA - CORREGIDO
// ==========================
exports.crear = async (req, res) => {
    const { nombre, rif, contacto, telefono, email, direccion, tipo, categorias } = req.body;
    let connection = null;
    
    try {
        // Obtener conexión
        connection = await db.getConnection();
        
        // INICIAR TRANSACCIÓN
        await connection.beginTransaction();
        
        // 1. INSERTAR EMPRESA
        const [result] = await connection.query(
            `INSERT INTO empresas 
             (nombre, rif, contacto, telefono, email, direccion, tipo, activo) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [nombre, rif || null, contacto || null, telefono || null, 
             email || null, direccion || null, tipo || 'pública']
        );
        
        const empresaId = result.insertId;
        
        // 2. INSERTAR CATEGORÍAS
        if (categorias && categorias.length > 0) {
            const categoriasArray = Array.isArray(categorias) ? categorias : [categorias];
            for (const catId of categoriasArray) {
                await connection.query(
                    'INSERT INTO empresa_categorias (empresa_id, categoria_id) VALUES (?, ?)',
                    [empresaId, catId]
                );
            }
        }
        
        // 3. CONFIRMAR TRANSACCIÓN
        await connection.commit();
        
        // 4. REGISTRAR AUDITORÍA
        await registrarAuditoria(
            req.session.usuario,
            'CREAR',
            'empresas',
            empresaId,
            null,
            { nombre, rif, contacto, telefono, email, direccion, tipo, categorias }
        );
        
        req.session.mensaje = 'Empresa creada exitosamente';
        res.redirect('/empresas');
        
    } catch (err) {
        console.error('❌ Error en crear empresa:', err);
        
        // HACER ROLLBACK SI HAY ERROR
        if (connection) {
            try {
                await connection.rollback();
                console.log('🔄 Rollback ejecutado correctamente');
            } catch (rollbackErr) {
                console.error('Error en rollback:', rollbackErr);
            }
        }
        
        req.session.error = err.sqlMessage || 'Error al crear empresa';
        res.redirect('/empresas/nueva');
        
    } finally {
        // SIEMPRE LIBERAR LA CONEXIÓN
        if (connection) {
            try {
                connection.release();
                console.log('🔄 Conexión liberada correctamente');
            } catch (releaseErr) {
                console.error('Error al liberar conexión:', releaseErr);
            }
        }
    }
};

// ==========================
// 📌 MOSTRAR FORMULARIO DE EDICIÓN
// ==========================
exports.formEditar = async (req, res) => {
    const { id } = req.params;
    
    try {
        const [empresa] = await db.query('SELECT * FROM empresas WHERE id = ? AND activo = 1', [id]);
        if (empresa.length === 0) {
            return res.status(404).send('Empresa no encontrada');
        }
        
        const [categoriasDb] = await db.query(
            'SELECT categoria_id FROM empresa_categorias WHERE empresa_id = ?',
            [id]
        );
        const categoriasSeleccionadas = categoriasDb.map(c => c.categoria_id);
        
        const [categorias] = await db.query("SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre");
        
        res.render('empresas/editar', { 
            empresa: empresa[0],
            categorias,
            categoriasSeleccionadas,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar formulario');
    }
};

// ==========================
// 📌 ACTUALIZAR EMPRESA - CORREGIDO
// ==========================
exports.actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre, rif, contacto, telefono, email, direccion, tipo, categorias } = req.body;
    let connection = null;
    
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        
        // Obtener datos anteriores
        const [empresaAnterior] = await connection.query('SELECT * FROM empresas WHERE id = ?', [id]);
        
        if (empresaAnterior.length === 0) {
            req.session.error = 'Empresa no encontrada';
            return res.redirect('/empresas');
        }
        
        // Actualizar empresa
        await connection.query(
            `UPDATE empresas SET 
             nombre = ?, rif = ?, contacto = ?, telefono = ?, 
             email = ?, direccion = ?, tipo = ? 
             WHERE id = ?`,
            [nombre, rif || null, contacto || null, telefono || null, 
             email || null, direccion || null, tipo || 'pública', id]
        );
        
        // Eliminar categorías anteriores
        await connection.query('DELETE FROM empresa_categorias WHERE empresa_id = ?', [id]);
        
        // Insertar nuevas categorías
        if (categorias && categorias.length > 0) {
            const categoriasArray = Array.isArray(categorias) ? categorias : [categorias];
            for (const catId of categoriasArray) {
                await connection.query(
                    'INSERT INTO empresa_categorias (empresa_id, categoria_id) VALUES (?, ?)',
                    [id, catId]
                );
            }
        }
        
        await connection.commit();
        
        await registrarAuditoria(
            req.session.usuario,
            'EDITAR',
            'empresas',
            id,
            empresaAnterior[0],
            { nombre, rif, contacto, telefono, email, direccion, tipo, categorias }
        );
        
        req.session.mensaje = 'Empresa actualizada exitosamente';
        res.redirect('/empresas');
        
    } catch (err) {
        console.error('❌ Error en actualizar empresa:', err);
        
        if (connection) {
            try {
                await connection.rollback();
                console.log('🔄 Rollback ejecutado correctamente');
            } catch (rollbackErr) {
                console.error('Error en rollback:', rollbackErr);
            }
        }
        
        req.session.error = err.sqlMessage || 'Error al actualizar empresa';
        res.redirect(`/empresas/${id}/editar`);
        
    } finally {
        if (connection) {
            try {
                connection.release();
                console.log('🔄 Conexión liberada correctamente');
            } catch (releaseErr) {
                console.error('Error al liberar conexión:', releaseErr);
            }
        }
    }
};

// ==========================
// 📌 DESACTIVAR EMPRESA (SOFT DELETE)
// ==========================
exports.desactivar = async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    try {
        const [empresaADesactivar] = await db.query(
            'SELECT nombre FROM empresas WHERE id = ? AND activo = 1',
            [id]
        );

        if (empresaADesactivar.length === 0) {
            req.session.error = 'Empresa no encontrada o ya está inactiva';
            return res.redirect('/empresas');
        }

        const [reportesAsociados] = await db.query(
            'SELECT COUNT(*) as total FROM reportes WHERE empresa_id = ? AND activo = 1',
            [id]
        );

        if (reportesAsociados[0].total > 0) {
            req.session.error = `No se puede desactivar la empresa porque tiene ${reportesAsociados[0].total} reportes asociados.`;
            return res.redirect('/empresas');
        }

        await db.query('UPDATE empresas SET activo = 0 WHERE id = ?', [id]);

        await registrarAuditoria(
            req.session.usuario,
            'DESACTIVAR',
            'empresas',
            id,
            empresaADesactivar[0],
            { motivo: motivo || 'Desactivado por administrador', activo: false }
        );

        req.session.mensaje = `Empresa "${empresaADesactivar[0].nombre}" desactivada correctamente`;
        res.redirect('/empresas');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al desactivar empresa';
        res.redirect('/empresas');
    }
};

// ==========================
// 📌 ACTIVAR EMPRESA (REACTIVAR)
// ==========================
exports.activar = async (req, res) => {
    const { id } = req.params;
    const { motivo } = req.body;

    try {
        const [empresaAActivar] = await db.query(
            'SELECT nombre FROM empresas WHERE id = ? AND activo = 0',
            [id]
        );

        if (empresaAActivar.length === 0) {
            req.session.error = 'Empresa no encontrada o ya está activa';
            return res.redirect('/empresas/inactivos');
        }

        await db.query('UPDATE empresas SET activo = 1 WHERE id = ?', [id]);

        await registrarAuditoria(
            req.session.usuario,
            'ACTIVAR',
            'empresas',
            id,
            { activo: false },
            { motivo: motivo || 'Reactivado por administrador', activo: true }
        );

        req.session.mensaje = `Empresa "${empresaAActivar[0].nombre}" activada correctamente`;
        res.redirect('/empresas/inactivos');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al activar empresa';
        res.redirect('/empresas/inactivos');
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
            return res.redirect('/empresas/inactivos');
        }

        if (!motivo || motivo.trim() === '') {
            req.session.error = 'Debe especificar un motivo para eliminar permanentemente la empresa';
            return res.redirect('/empresas/inactivos');
        }

        const [empresaAEliminar] = await db.query(
            'SELECT nombre, id FROM empresas WHERE id = ?',
            [id]
        );

        if (empresaAEliminar.length === 0) {
            req.session.error = 'Empresa no encontrada';
            return res.redirect('/empresas/inactivos');
        }

        const [reportesAsociados] = await db.query(
            'SELECT COUNT(*) as total FROM reportes WHERE empresa_id = ?',
            [id]
        );

        if (reportesAsociados[0].total > 0) {
            req.session.error = `No se puede eliminar la empresa porque tiene ${reportesAsociados[0].total} reportes asociados.`;
            return res.redirect('/empresas/inactivos');
        }

        const datosEmpresa = empresaAEliminar[0];
        const datosConMotivo = {
            ...datosEmpresa,
            motivo_eliminacion: motivo.trim(),
            eliminado_por: req.session.usuario.nombre,
            fecha_eliminacion: new Date().toLocaleString()
        };

        await db.query('DELETE FROM empresas WHERE id = ?', [id]);

        await registrarAuditoria(
            req.session.usuario,
            'ELIMINAR_PERMANENTEMENTE',
            'empresas',
            id,
            datosConMotivo,
            { motivo: motivo.trim(), eliminado_por: req.session.usuario.nombre }
        );

        req.session.mensaje = `Empresa "${datosEmpresa.nombre}" eliminada permanentemente. Motivo: ${motivo}`;
        res.redirect('/empresas/inactivos');
    } catch (err) {
        console.error('Error en destruir:', err);
        req.session.error = 'Error al eliminar empresa permanentemente';
        res.redirect('/empresas/inactivos');
    }
};

// ==========================
// 📌 OBTENER EMPRESAS POR CATEGORÍA (API)
// ==========================
exports.porCategoria = async (req, res) => {
    const { categoriaId } = req.params;
    
    try {
        const [empresas] = await db.query(`
            SELECT e.* 
            FROM empresas e
            INNER JOIN empresa_categorias ec ON e.id = ec.empresa_id
            WHERE ec.categoria_id = ? AND e.activo = 1
            ORDER BY e.nombre
        `, [categoriaId]);
        
        res.json(empresas);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener empresas' });
    }
};