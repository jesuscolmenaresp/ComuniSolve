const express = require('express');
const router = express.Router();
const db = require('../models/db');

// 📌 Página de inicio - Redirecciona según el rol
router.get('/', async (req, res) => {
  // Si el usuario está logueado, redireccionar a su panel correspondiente
  if (req.session.usuario) {
    const rol = req.session.usuario.rol_id;
    
    switch(rol) {
      case 1: // UBCH
        return res.redirect('/admin');
      case 2: // Líder
        return res.redirect('/lider');
      case 3: // Jefe de Calle
        return res.redirect('/jefe');
      case 4: // Ciudadano
        // El ciudadano ve la página de inicio normal
        break;
      default:
        break;
    }
  }
  
  // Si no está logueado o es ciudadano, mostrar la página normal
  try {
    const [reportes] = await db.query(`
      SELECT r.id, r.titulo, r.descripcion, r.estado,
             r.ubicacion_lat, r.ubicacion_lng,
             c.nombre AS nombre_calle,
             cat.nombre AS categoria_nombre,
             cat.icono AS categoria_icono,
             cat.color AS categoria_color
      FROM reportes r
      INNER JOIN calles c ON r.calle_id = c.id
      INNER JOIN categorias cat ON r.categoria_id = cat.id
      ORDER BY r.fecha DESC
      LIMIT 10
    `);
    
    res.render('index', { 
      title: 'ComuniSolve - Bienvenido', 
      usuario: req.session.usuario, 
      reportes 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al cargar la página principal");
  }
});

module.exports = router;