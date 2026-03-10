const db = require('../models/db');

// 📌 Listar empresas
exports.listar = async (req, res) => {
    try {
        const [empresas] = await db.query(`
            SELECT e.*, 
                   GROUP_CONCAT(c.nombre) as categorias_nombres
            FROM empresas e
            LEFT JOIN empresa_categorias ec ON e.id = ec.empresa_id
            LEFT JOIN categorias c ON ec.categoria_id = c.id
            GROUP BY e.id
            ORDER BY e.nombre
        `);
        
        res.render('empresas/listar', { 
            empresas,
            usuario: req.session.usuario,
            session: req.session
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al listar empresas');
    }
};

// 📌 Mostrar formulario de nueva empresa
exports.formCrear = async (req, res) => {
    try {
        const [categorias] = await db.query("SELECT * FROM categorias ORDER BY nombre");
        
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

// 📌 Guardar nueva empresa
exports.crear = async (req, res) => {
    const { nombre, rif, contacto, telefono, email, direccion, tipo, categorias } = req.body;
    
    try {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        const [result] = await connection.query(
            `INSERT INTO empresas 
             (nombre, rif, contacto, telefono, email, direccion, tipo) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nombre, rif || null, contacto || null, telefono || null, 
             email || null, direccion || null, tipo || 'pública']
        );
        
        const empresaId = result.insertId;
        
        // Insertar categorías (IDs)
        if (categorias && categorias.length > 0) {
            const categoriasArray = Array.isArray(categorias) ? categorias : [categorias];
            for (const catId of categoriasArray) {
                await connection.query(
                    'INSERT INTO empresa_categorias (empresa_id, categoria_id) VALUES (?, ?)',
                    [empresaId, catId]
                );
            }
        }
        
        await connection.commit();
        connection.release();
        
        req.session.mensaje = 'Empresa creada exitosamente';
        res.redirect('/empresas');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al crear empresa';
        res.redirect('/empresas/nueva');
    }
};

// 📌 Mostrar formulario de edición
exports.formEditar = async (req, res) => {
    const { id } = req.params;
    
    try {
        const [empresa] = await db.query('SELECT * FROM empresas WHERE id = ?', [id]);
        if (empresa.length === 0) {
            return res.status(404).send('Empresa no encontrada');
        }
        
        // Obtener categorías de la empresa (IDs)
        const [categoriasDb] = await db.query(
            'SELECT categoria_id FROM empresa_categorias WHERE empresa_id = ?',
            [id]
        );
        const categoriasSeleccionadas = categoriasDb.map(c => c.categoria_id);
        
        // Categorías disponibles
        const [categorias] = await db.query("SELECT * FROM categorias ORDER BY nombre");
        
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

// 📌 Actualizar empresa
exports.actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre, rif, contacto, telefono, email, direccion, tipo, categorias } = req.body;
    
    try {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
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
        
        // Insertar nuevas categorías (IDs)
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
        connection.release();
        
        req.session.mensaje = 'Empresa actualizada exitosamente';
        res.redirect('/empresas');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al actualizar empresa';
        res.redirect(`/empresas/${id}/editar`);
    }
};

// 📌 Eliminar empresa
exports.eliminar = async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('DELETE FROM empresas WHERE id = ?', [id]);
        req.session.mensaje = 'Empresa eliminada exitosamente';
        res.redirect('/empresas');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al eliminar empresa';
        res.redirect('/empresas');
    }
};

// 📌 Obtener empresas por categoría (para API)
exports.porCategoria = async (req, res) => {
    const { categoriaId } = req.params;
    
    try {
        const [empresas] = await db.query(`
            SELECT e.* 
            FROM empresas e
            INNER JOIN empresa_categorias ec ON e.id = ec.empresa_id
            WHERE ec.categoria_id = ?
            ORDER BY e.nombre
        `, [categoriaId]);
        
        res.json(empresas);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener empresas' });
    }
};