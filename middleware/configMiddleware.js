const db = require('../models/db');

// Middleware para cargar la configuración del sistema
async function cargarConfiguracion(req, res, next) {
    try {
        // Obtener configuración de la base de datos
        const [rows] = await db.query('SELECT dark_mode FROM configuracion WHERE id = 1');
        const darkMode = rows[0]?.dark_mode === 1;
        
        // Poner la configuración en res.locals para que esté disponible en todas las vistas
        res.locals.darkMode = darkMode;
        
        next();
    } catch (error) {
        console.error('Error al cargar configuración:', error);
        res.locals.darkMode = false;
        next();
    }
}

module.exports = { cargarConfiguracion };