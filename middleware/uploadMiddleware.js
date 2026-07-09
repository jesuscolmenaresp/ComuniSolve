const multer = require("multer");
const path = require("path");
const fs = require('fs');

// 📂 Configurar almacenamiento para reportes
const storageReportes = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/reportes";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// 📂 Configurar almacenamiento para fotos de perfil
const storagePerfil = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads/perfiles";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "perfil-" + uniqueSuffix + path.extname(file.originalname));
  }
});

// 📌 Filtro de archivos (solo imágenes)
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes (jpeg, jpg, png, gif, webp)"));
  }
};

// ========== LÍMITES AUMENTADOS ==========
const MAX_REPORTE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PERFIL_SIZE = 5 * 1024 * 1024;   // 5 MB (aumentado de 2MB)

// Middleware para reportes
const uploadReportes = multer({
  storage: storageReportes,
  fileFilter,
  limits: { 
    fileSize: MAX_REPORTE_SIZE
  }
});

// Middleware para fotos de perfil
const uploadPerfil = multer({
  storage: storagePerfil,
  fileFilter,
  limits: { 
    fileSize: MAX_PERFIL_SIZE  // 5 MB (aumentado)
  }
});

// ========== MIDDLEWARE DE ERROR PARA MULTER ==========
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      req.session.error = `El archivo es demasiado grande. Máximo 5 MB.`;
      return res.redirect('/reportar');
    }
    req.session.error = 'Error al subir el archivo: ' + err.message;
    return res.redirect('/reportar');
  }
  if (err) {
    req.session.error = err.message;
    return res.redirect('/reportar');
  }
  next();
};

module.exports = { 
  upload: uploadReportes,
  uploadPerfil,
  uploadReportes,
  handleMulterError,
  MAX_REPORTE_SIZE,
  MAX_PERFIL_SIZE
};