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

// Middleware para reportes
const uploadReportes = multer({
  storage: storageReportes,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Middleware para fotos de perfil
const uploadPerfil = multer({
  storage: storagePerfil,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

module.exports = { 
  upload: uploadReportes,
  uploadPerfil,
  uploadReportes 
};