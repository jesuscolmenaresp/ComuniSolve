const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Procesar imagen de perfil (cuadrado, 200x200)
async function procesarFotoPerfil(filePath) {
  try {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const basename = path.basename(filePath, ext);
    const outputPath = path.join(dir, basename + '-processed' + ext);
    
    await sharp(filePath)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
    
    // Reemplazar archivo original con el procesado
    fs.unlinkSync(filePath);
    fs.renameSync(outputPath, filePath);
    
    return filePath;
  } catch (error) {
    console.error('Error procesando imagen:', error);
    return filePath;
  }
}

module.exports = { procesarFotoPerfil };