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
// Aumentar de 5MB a 10MB (o 20MB si necesitas más)
const MAX_REPORTE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PERFIL_SIZE = 2 * 1024 * 1024;   // 2 MB

// Middleware para reportes
const uploadReportes = multer({
  storage: storageReportes,
  fileFilter,
  limits: { 
    fileSize: MAX_REPORTE_SIZE  // <--- CAMBIADO de 5MB a 10MB
  }
});

// Middleware para fotos de perfil
const uploadPerfil = multer({
  storage: storagePerfil,
  fileFilter,
  limits: { 
    fileSize: MAX_PERFIL_SIZE  // 2MB (se mantiene)
  }
});

// ========== MIDDLEWARE DE ERROR PARA MULTER ==========
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      req.session.error = `El archivo es demasiado grande. Máximo ${MAX_REPORTE_SIZE / 1024 / 1024} MB.`;
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
  MAX_REPORTE_SIZE
};