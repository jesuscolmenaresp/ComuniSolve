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

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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

// Pasar datos de sesión a todas las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  next();
});

// Middleware para verificar si el usuario es voluntario
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

// Motor de vistas
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Layouts
app.use(expressLayouts);
app.set('layout', 'layout');

// Rutas
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

// Iniciar servidor
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