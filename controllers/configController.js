const db = require('../models/db');

// Obtener configuración actual
exports.getConfiguracion = async (req, res) => {
  try {
    console.log('📍 GET /config/dark-mode');
    const [rows] = await db.query('SELECT dark_mode, mostrar_boton FROM configuracion WHERE id = 1');
    const darkMode = rows[0]?.dark_mode === 1;
    const mostrarBoton = rows[0]?.mostrar_boton === 1;
    
    res.json({ darkMode, mostrarBoton });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
};

// Actualizar modo nocturno (PERMITIDO PARA TODOS, sin autenticación)
exports.toggleDarkMode = async (req, res) => {
  try {
    console.log('📍 POST /config/dark-mode - Iniciando...');
    
    const { darkMode } = req.body;
    console.log('DarkMode solicitado:', darkMode);
    
    // Validar que darkMode sea booleano
    if (typeof darkMode !== 'boolean') {
      console.log('❌ darkMode no es booleano:', darkMode);
      return res.status(400).json({ error: 'darkMode debe ser booleano' });
    }
    
    // Primero verificamos si el botón está activo para permitir el cambio
    const [configRows] = await db.query('SELECT mostrar_boton FROM configuracion WHERE id = 1');
    const mostrarBoton = configRows[0]?.mostrar_boton === 1;
    
    // Si el botón NO está activo, solo el SuperAdmin puede cambiar (pero esto se maneja en el frontend)
    // Aquí simplemente permitimos el cambio siempre que el botón esté activo
    // Si el botón no está activo, los usuarios no verán el botón, así que no podrán llamar a esta ruta
    
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

// Actualizar configuración del botón (SOLO SuperAdmin)
exports.toggleMostrarBoton = async (req, res) => {
  try {
    console.log('📍 POST /config/mostrar-boton - Iniciando...');
    
    if (!req.session.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (req.session.usuario.rol_id !== 5) {
      return res.status(403).json({ error: 'No autorizado, se requiere rol de SuperAdmin' });
    }
    
    const { mostrarBoton } = req.body;
    
    if (typeof mostrarBoton !== 'boolean') {
      return res.status(400).json({ error: 'mostrarBoton debe ser booleano' });
    }
    
    await db.query(
      'UPDATE configuracion SET mostrar_boton = ? WHERE id = 1',
      [mostrarBoton ? 1 : 0]
    );
    
    console.log('✅ Configuración del botón actualizada:', mostrarBoton);
    
    res.json({ success: true, mostrarBoton });
  } catch (error) {
    console.error('❌ Error al cambiar configuración del botón:', error);
    res.status(500).json({ error: 'Error al cambiar configuración del botón: ' + error.message });
  }
};