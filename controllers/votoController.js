const db = require('../models/db');

// 📌 Votar por un reporte
exports.votar = async (req, res) => {
    const { reporteId } = req.params;
    const usuarioId = req.session.usuario.id;

    try {
        // Verificar que el reporte existe
        const [reporte] = await db.query('SELECT id FROM reportes WHERE id = ?', [reporteId]);
        if (reporte.length === 0) {
            req.session.error = 'Reporte no encontrado';
            return res.redirect('/reportes');
        }

        // Intentar insertar el voto (la base de datos evita duplicados)
        await db.query(
            'INSERT INTO votos (reporte_id, usuario_id) VALUES (?, ?)',
            [reporteId, usuarioId]
        );

        req.session.mensaje = '¡Voto registrado exitosamente!';
        res.redirect('/reportes');
    } catch (err) {
        // Error 1062 = duplicate entry (ya votó)
        if (err.code === 'ER_DUP_ENTRY') {
            req.session.error = 'Ya has votado por este reporte';
        } else {
            console.error(err);
            req.session.error = 'Error al registrar el voto';
        }
        res.redirect('/reportes');
    }
};

// 📌 Obtener conteo de votos para todos los reportes
exports.obtenerConteos = async (req, res, next) => {
    try {
        const [votos] = await db.query(`
            SELECT reporte_id, COUNT(*) as total
            FROM votos
            GROUP BY reporte_id
        `);

        // Crear un objeto para fácil acceso: { reporte_id: total, ... }
        const conteoVotos = {};
        votos.forEach(v => {
            conteoVotos[v.reporte_id] = v.total;
        });

        // Guardar en res.locals para que esté disponible en todas las vistas
        res.locals.conteoVotos = conteoVotos;
        
        // También verificar qué reportes ha votado el usuario actual
        if (req.session.usuario) {
            const [misVotos] = await db.query(
                'SELECT reporte_id FROM votos WHERE usuario_id = ?',
                [req.session.usuario.id]
            );
            
            const votosUsuario = {};
            misVotos.forEach(v => {
                votosUsuario[v.reporte_id] = true;
            });
            res.locals.votosUsuario = votosUsuario;
        }

        next();
    } catch (err) {
        console.error(err);
        next();
    }
};