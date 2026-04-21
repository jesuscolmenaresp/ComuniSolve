const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');

const app = express();

// Configurar variables de entorno
dotenv.config();

// Puerto dinámico para producción (Render asigna el puerto automáticamente)
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'comunisolve-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true en producción (HTTPS)
    maxAge: 1000 * 60 * 60 * 24 // 24 horas
  }
}));

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
      console.error('Error al verificar voluntario:', err);
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

app.use('/', indexRouter);
app.use(authRoutes);
app.use(reporteRoutes);
app.use(dashboardRoutes);
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

// Exportar app (para pruebas)
module.exports = app;