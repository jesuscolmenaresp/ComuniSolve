const express = require('express');
const router = express.Router();
const db = require('../models/db');

// 📌 Página de inicio
router.get('/', async (req, res) => {
  try {
    const [reportes] = await db.query(`
      SELECT r.id, r.titulo, r.descripcion, r.categoria, r.estado,
             r.ubicacion_lat, r.ubicacion_lng,
             c.nombre AS nombre_calle
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      ORDER BY r.fecha DESC
      LIMIT 10
    `);

    res.render('index', { title: 'ComuniSolve - Bienvenido', usuario: req.session.usuario, reportes });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar la página principal");
  }
});

module.exports = router;
