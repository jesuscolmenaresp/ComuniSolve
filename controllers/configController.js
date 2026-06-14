const db = require('../models/db');

// Obtener configuración actual
exports.getConfiguracion = async (req, res) => {
  try {
    console.log('📍 GET /config/dark-mode - Usuario:', req.session.usuario?.id);
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
    console.log('📍 POST /config/dark-mode - Iniciando...');
    console.log('Usuario en sesión:', req.session.usuario);
    
    // Verificar autenticación
    if (!req.session.usuario) {
      console.log('❌ No autenticado');
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    // Verificar que sea SuperAdmin (rol 5)
    if (req.session.usuario.rol_id !== 5) {
      console.log('❌ No es SuperAdmin, rol:', req.session.usuario.rol_id);
      return res.status(403).json({ error: 'No autorizado, se requiere rol de SuperAdmin' });
    }
    
    const { darkMode } = req.body;
    console.log('DarkMode solicitado:', darkMode);
    
    // Validar que darkMode sea booleano
    if (typeof darkMode !== 'boolean') {
      console.log('❌ darkMode no es booleano:', darkMode);
      return res.status(400).json({ error: 'darkMode debe ser booleano' });
    }
    
    await db.query(
      'UPDATE configuracion SET dark_mode = ? WHERE id = 1',
      [darkMode ? 1 : 0]
    );
    
    console.log('✅ Configuración actualizada');
    
    res.json({ success: true, darkMode });
  } catch (error) {
    console.error('❌ Error al cambiar modo nocturno:', error);
    res.status(500).json({ error: 'Error al cambiar modo nocturno: ' + error.message });
  }
};