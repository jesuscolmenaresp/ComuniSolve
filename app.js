const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');

const app = express();

// Configurar variables de entorno - SOLO en desarrollo
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
  console.log('📝 Desarrollo: cargando variables desde .env');
} else {
  console.log('🚀 Producción: usando variables de entorno del sistema (Render)');
}

// Timeout global para peticiones (evita cold starts eternos)
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(504).send('Tiempo de espera agotado. Por favor, recarga la página.');
  });
  next();
});

// Puerto dinámico para producción
const PORT = process.env.PORT || 3000;

// Health check endpoint (para Render y UptimeRobot)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Middlewares - AUMENTAR LÍMITES
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb'  // <-- AUMENTAR de 5MB a 10MB
}));
app.use(express.json({ 
  limit: '10mb'  // <-- AUMENTAR de 5MB a 10MB
}));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de sesión MEJORADA para producción
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'comunisolve-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'lax'
  }
};

// En producción (Render), configurar secure y proxy
if (process.env.NODE_ENV === 'production') {
  sessionConfig.cookie.secure = true;
  sessionConfig.proxy = true;
  sessionConfig.trustProxy = 1;
}

app.use(session(sessionConfig));

// ================================================
// MAPEO DE ICONOS PARA CATEGORÍAS
// ================================================
const iconMap = {
    // Por nombre de categoría (más confiable)
    'Agua': 'bi-droplet',
    'Electricidad': 'bi-lightning',
    'Vialidad': 'bi-signpost-2',
    'Salud': 'bi-hospital',
    'Educación': 'bi-book',
    'Seguridad': 'bi-shield',
    'Ambiente': 'bi-tree',
    'Aguas Servidas': 'bi-droplet-half',
    'Alimentación': 'bi-apple',
    'Basura': 'bi-trash',
    'Áreas Verdes': 'bi-tree',
    'Animales': 'bi-paw',
    'Ruido': 'bi-volume-up',
    'Alumbrado': 'bi-lightbulb',
    
    // Por emoji (fallback)
    '💧': 'bi-droplet',
    '⚡': 'bi-lightning',
    '🚧': 'bi-signpost-2',
    '🏥': 'bi-hospital',
    '🗑️': 'bi-trash',
    '🌳': 'bi-tree',
    '🐶': 'bi-paw',
    '🔊': 'bi-volume-up',
    '💡': 'bi-lightbulb',
    '📦': 'bi-box',
    '📚': 'bi-book',
    '🌿': 'bi-tree',
    '🚰': 'bi-droplet-half',
    '🍅': 'bi-apple',
    '🟢': 'bi-circle-fill',
    '🔴': 'bi-circle-fill',
    '🟡': 'bi-circle-fill',
    '🔵': 'bi-circle-fill',
    '⚫': 'bi-circle-fill',
    '⚪': 'bi-circle',
    '🛡️': 'bi-shield'
};

// Helper para renderizar iconos en HTML (con etiquetas <i>)
// Úsalo en: listar.ejs (badges), crear.ejs, editar.ejs
app.locals.renderIcon = function(icono) {
    if (!icono) return '';
    
    // Si ya es una clase de Bootstrap Icon
    if (icono.startsWith('bi-')) {
        return `<i class="bi ${icono}"></i>`;
    }
    
    // Si es un emoji, buscar en el mapa
    if (iconMap[icono]) {
        return `<i class="bi ${iconMap[icono]}"></i>`;
    }
    
    // Si es un texto que coincide con una categoría
    if (iconMap[icono.trim()]) {
        return `<i class="bi ${iconMap[icono.trim()]}"></i>`;
    }
    
    // Si no se encuentra, mostrar el emoji directamente
    return icono;
};

// ================================================
// MIDDLEWARES GLOBALES (se ejecutan en orden)
// ================================================

// 1. Pasar datos de sesión a todas las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  next();
});

// 2. Cargar configuración del sistema (modo nocturno, etc.)
const { cargarConfiguracion } = require('./middleware/configMiddleware');
app.use(cargarConfiguracion);

// 3. Middleware para verificar si el usuario es voluntario
app.use(async (req, res, next) => {
  if (req.session.usuario && req.session.usuario.rol_id === 4) {
    try {
      const db = require('./models/db');
      const [voluntario] = await db.query(
        'SELECT id, estado FROM voluntarios WHERE usuario_id = ?',
        [req.session.usuario.id]
      );
      res.locals.esVoluntario = voluntario.length > 0;
      res.locals.estadoVoluntario = voluntario[0]?.estado || null;
    } catch (err) {
      console.error('Error al verificar voluntario:', err.message);
      res.locals.esVoluntario = false;
      res.locals.estadoVoluntario = null;
    }
  } else {
    res.locals.esVoluntario = false;
    res.locals.estadoVoluntario = null;
  }
  next();
});

// ================================================
// MOTOR DE VISTAS
// ================================================
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Layouts
app.use(expressLayouts);
app.set('layout', 'layout');

// ================================================
// RUTAS
// ================================================
const authRoutes = require('./routes/auth');
const reporteRoutes = require('./routes/reportes');
const indexRouter = require('./routes/index');
const dashboardRoutes = require('./routes/dashboard');
const voluntarioRoutes = require('./routes/voluntarios');
const mapasRoutes = require('./routes/mapas');

const calleRoutes = require("./routes/calles");
const votoRoutes = require('./routes/votos');
const votoController = require('./controllers/votoController');

const usuarioRoutes = require('./routes/usuarios');

const comunidadesRoutes = require('./routes/comunidades');

const empresasRoutes = require('./routes/empresas');

const categoriasRoutes = require('./routes/categorias');

const auditoriaRoutes = require('./routes/auditoria');

const perfilRoutes = require('./routes/perfil');

const superadminRoutes = require('./routes/superadmin');

const configRoutes = require('./routes/config');

const notificacionesRoutes = require('./routes/notificaciones');

app.use('/', indexRouter);
app.use(authRoutes);
app.use(reporteRoutes);
app.use('/dashboard', dashboardRoutes);
app.use(calleRoutes);
app.use(voluntarioRoutes);
app.use(mapasRoutes);

app.use(votoRoutes);
app.use(votoController.obtenerConteos);

app.use(usuarioRoutes);

app.use(comunidadesRoutes);

app.use(empresasRoutes);

app.use(categoriasRoutes);

app.use(auditoriaRoutes);

app.use(perfilRoutes);

app.use('/superadmin', superadminRoutes);

app.use('/config', configRoutes);

app.use('/', notificacionesRoutes);

// ================================================
// INICIAR SERVIDOR
// ================================================
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕒 ${new Date().toLocaleString()}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log('🔧 Variables de entorno detectadas:');
    console.log(`   - MAILJET_API_KEY: ${process.env.MAILJET_API_KEY ? '✅' : '❌'}`);
    console.log(`   - MAILJET_SECRET_KEY: ${process.env.MAILJET_SECRET_KEY ? '✅' : '❌'}`);
    console.log(`   - MAILJET_FROM_EMAIL: ${process.env.MAILJET_FROM_EMAIL ? '✅' : '❌'}`);
    console.log(`   - DB_HOST: ${process.env.DB_HOST ? '✅' : '❌'}`);
  }
});

module.exports = app;