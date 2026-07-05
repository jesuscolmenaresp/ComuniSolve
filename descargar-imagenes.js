// descargar-imagenes.js
// ================================================
// SCRIPT PARA DESCARGAR IMÁGENES DESDE RENDER
// ================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const db = require('./models/db');

// Configuración
const DOMAIN = 'https://comunisolve.onrender.com';
const LOCAL_UPLOADS_DIR = './public/uploads';

// Función para descargar una imagen
function descargarImagen(url, rutaLocal) {
    return new Promise((resolve, reject) => {
        // Verificar si la imagen ya existe
        if (fs.existsSync(rutaLocal)) {
            console.log(`  ⏭️ ${path.basename(rutaLocal)} (ya existe)`);
            return resolve();
        }

        const file = fs.createWriteStream(rutaLocal);
        https.get(url, (response) => {
            if (response.statusCode === 404) {
                console.log(`  ❌ ${path.basename(rutaLocal)} (no encontrada)`);
                file.close();
                fs.unlink(rutaLocal, () => {});
                return resolve();
            }
            
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`  ✅ ${path.basename(rutaLocal)}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(rutaLocal, () => {});
            console.log(`  ❌ ${path.basename(rutaLocal)} (error: ${err.message})`);
            resolve();
        });
    });
}

// Función principal
async function sincronizarImagenes() {
    console.log('📸 ==========================================');
    console.log('📸 SINCRONIZANDO IMÁGENES DESDE RENDER');
    console.log('📸 ==========================================\n');

    try {
        // 1. Obtener reportes con imágenes
        console.log('📊 Buscando reportes con imágenes...');
        const [reportes] = await db.query(`
            SELECT id, titulo, imagen 
            FROM reportes 
            WHERE imagen IS NOT NULL AND imagen != ''
        `);
        
        console.log(`📊 Encontrados ${reportes.length} reportes con imágenes\n`);

        // 2. Crear carpeta de reportes
        const dirReportes = path.join(LOCAL_UPLOADS_DIR, 'reportes');
        if (!fs.existsSync(dirReportes)) {
            fs.mkdirSync(dirReportes, { recursive: true });
        }

        // 3. Descargar imágenes de reportes
        console.log('📥 Descargando imágenes de reportes...');
        for (const reporte of reportes) {
            const nombreArchivo = path.basename(reporte.imagen);
            const urlCompleta = `${DOMAIN}${reporte.imagen}`;
            const rutaLocal = path.join(dirReportes, nombreArchivo);
            
            await descargarImagen(urlCompleta, rutaLocal);
        }

        // 4. Obtener usuarios con fotos de perfil
        console.log('\n📊 Buscando usuarios con foto de perfil...');
        const [usuarios] = await db.query(`
            SELECT id, nombre, foto_perfil 
            FROM usuarios 
            WHERE foto_perfil IS NOT NULL AND foto_perfil != ''
        `);
        
        console.log(`📊 Encontrados ${usuarios.length} usuarios con foto de perfil\n`);

        // 5. Crear carpeta de perfiles
        const dirPerfiles = path.join(LOCAL_UPLOADS_DIR, 'perfiles');
        if (!fs.existsSync(dirPerfiles)) {
            fs.mkdirSync(dirPerfiles, { recursive: true });
        }

        // 6. Descargar fotos de perfil
        console.log('📥 Descargando fotos de perfil...');
        for (const usuario of usuarios) {
            const nombreArchivo = path.basename(usuario.foto_perfil);
            const urlCompleta = `${DOMAIN}${usuario.foto_perfil}`;
            const rutaLocal = path.join(dirPerfiles, nombreArchivo);
            
            await descargarImagen(urlCompleta, rutaLocal);
        }

        console.log('\n✅ ==========================================');
        console.log('✅ ¡TODAS LAS IMÁGENES SINCRONIZADAS!');
        console.log('✅ ==========================================\n');
        
        // Mostrar resumen
        console.log('📊 RESUMEN:');
        console.log(`   📸 Reportes con imagen: ${reportes.length}`);
        console.log(`   👤 Usuarios con foto: ${usuarios.length}`);
        console.log(`   📁 Carpeta de reportes: ${dirReportes}`);
        console.log(`   📁 Carpeta de perfiles: ${dirPerfiles}`);
        console.log('\n💡 Ahora puedes trabajar en local con todas las imágenes!');

    } catch (error) {
        console.error('❌ Error general:', error.message);
        console.error(error.stack);
    }

    // Cerrar conexión a la base de datos
    process.exit(0);
}

// Ejecutar
console.log('🚀 Iniciando sincronización...\n');
sincronizarImagenes();