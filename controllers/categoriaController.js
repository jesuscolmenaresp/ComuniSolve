const db = require('../models/db');

// 📌 Listar categorías
exports.listar = async (req, res) => {
    try {
        const [categorias] = await db.query(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM reportes WHERE categoria_id = c.id) as total_reportes
            FROM categorias c
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

// 📌 Mostrar formulario de nueva categoría
exports.formCrear = (req, res) => {
    res.render('categorias/crear', { 
        usuario: req.session.usuario,
        session: req.session
    });
};

// 📌 Guardar nueva categoría
exports.crear = async (req, res) => {
    const { nombre, descripcion, icono, color } = req.body;
    
    try {
        await db.query(
            'INSERT INTO categorias (nombre, descripcion, icono, color) VALUES (?, ?, ?, ?)',
            [nombre, descripcion || null, icono || null, color || 'secondary']
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

// 📌 Mostrar formulario de edición
exports.formEditar = async (req, res) => {
    const { id } = req.params;
    
    try {
        const [categoria] = await db.query('SELECT * FROM categorias WHERE id = ?', [id]);
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

// 📌 Actualizar categoría
exports.actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, icono, color } = req.body;
    
    try {
        await db.query(
            'UPDATE categorias SET nombre = ?, descripcion = ?, icono = ?, color = ? WHERE id = ?',
            [nombre, descripcion || null, icono || null, color || 'secondary', id]
        );
        
        req.session.mensaje = 'Categoría actualizada exitosamente';
        res.redirect('/categorias');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al actualizar categoría';
        res.redirect(`/categorias/${id}/editar`);
    }
};

// 📌 Eliminar categoría
exports.eliminar = async (req, res) => {
    const { id } = req.params;
    
    try {
        // Verificar si hay reportes usando esta categoría
        const [reportes] = await db.query(
            'SELECT COUNT(*) as total FROM reportes WHERE categoria_id = ?',
            [id]
        );
        
        if (reportes[0].total > 0) {
            req.session.error = 'No se puede eliminar: hay reportes asociados a esta categoría';
            return res.redirect('/categorias');
        }
        
        await db.query('DELETE FROM categorias WHERE id = ?', [id]);
        
        req.session.mensaje = 'Categoría eliminada exitosamente';
        res.redirect('/categorias');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error al eliminar categoría';
        res.redirect('/categorias');
    }
};

// 📌 Obtener todas las categorías (para usar en formularios)
exports.getCategorias = async (req, res) => {
    try {
        const [categorias] = await db.query('SELECT * FROM categorias ORDER BY nombre');
        res.json(categorias);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};