const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');

const app = express();

// Configurar variables de entorno
dotenv.config();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'comunisolve-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Pasar datos de sesión a todas las vistas
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  next();
});

// Motor de vistas
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Layouts
app.use(expressLayouts);
app.set('layout', 'layout'); // layout.ejs como plantilla base

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

// Exportar app
module.exports = app;
