const express = require('express');
const router = express.Router();
const db = require('../models/db');

// 📌 Página de mapas (todos los reportes geolocalizados)
router.get('/mapas', async (req, res) => {
    try {
        const [reportes] = await db.query(`
            SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
                   r.ubicacion_lat, r.ubicacion_lng, r.imagen,
                   u.nombre AS nombre_usuario,
                   c.nombre AS nombre_calle,
                   cat.nombre AS categoria_nombre,
                   cat.icono AS categoria_icono,
                   cat.color AS categoria_color
            FROM reportes r
            LEFT JOIN usuarios u ON r.usuario_id = u.id
            INNER JOIN calles c ON r.calle_id = c.id
            INNER JOIN categorias cat ON r.categoria_id = cat.id
            WHERE r.ubicacion_lat IS NOT NULL AND r.ubicacion_lng IS NOT NULL
            ORDER BY r.fecha DESC
        `);
        
        res.render('mapa', { 
            title: 'Mapa de Reportes',
            reportes,
            usuario: req.session.usuario 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al cargar el mapa');
    }
});

module.exports = router;