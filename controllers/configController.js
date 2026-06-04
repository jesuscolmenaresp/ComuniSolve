const db = require('../models/db');

// Obtener configuración actual
exports.getConfiguracion = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT dark_mode FROM configuracion WHERE id = 1');
    const darkMode = rows[0]?.dark_mode === 1;
    
    res.json({ darkMode });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
};

// Actualizar modo nocturno (solo SuperAdmin)
exports.toggleDarkMode = async (req, res) => {
  try {
    // Verificar que sea SuperAdmin (rol 5)
    if (!req.session.usuario || req.session.usuario.rol_id !== 5) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const { darkMode } = req.body;
    
    await db.query(
      'UPDATE configuracion SET dark_mode = ? WHERE id = 1',
      [darkMode ? 1 : 0]
    );
    
    // Registrar en auditoría
    const { registrarAuditoria } = require('../middleware/auditoriaMiddleware');
    await registrarAuditoria(
      req.session.usuario,
      'ACTUALIZAR',
      'configuracion',
      null,
      null,
      { accion: 'toggle_dark_mode', estado: darkMode ? 'activado' : 'desactivado' }
    );
    
    res.json({ success: true, darkMode });
  } catch (error) {
    console.error('Error al cambiar modo nocturno:', error);
    res.status(500).json({ error: 'Error al cambiar modo nocturno' });
  }
};