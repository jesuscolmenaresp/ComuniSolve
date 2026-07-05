// sincronizar-todo.js
// ================================================
// SCRIPT PARA SINCRONIZAR TODO: BD + IMÁGENES
// ================================================

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 ==========================================');
console.log('🚀 SINCRONIZANDO TODO DESDE PRODUCCIÓN');
console.log('🚀 ==========================================\n');

// 1. Exportar base de datos desde TiDB
console.log('📤 PASO 1: Exportando base de datos desde TiDB...');
console.log('   (Esto puede tomar unos minutos)\n');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFile = `C:\\backups\\comunisolve_db_${timestamp}.sql`;

// Crear carpeta de backups si no existe
if (!fs.existsSync('C:\\backups')) {
    fs.mkdirSync('C:\\backups', { recursive: true });
}

const exportCmd = `mysqldump --host=gateway01.us-west-2.prod.aws.tidbcloud.com --port=4000 --user=3LKodnGRMSm39XZ.root --password=s87ZuigL2kx0fYdZ --databases comuniSolve_db --single-transaction --skip-lock-tables --result-file="${backupFile}"`;

exec(exportCmd, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Error al exportar: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`⚠️ ${stderr}`);
    }
    
    console.log(`✅ Base de datos exportada: ${backupFile}\n`);

    // 2. Importar a local
    console.log('📥 PASO 2: Importando a base de datos LOCAL...');
    console.log('   (Esto puede tomar unos minutos)\n');

    const importCmd = `mysql --host=localhost --port=3306 --user=root --password=12345hola --database=comunisolve_db < "${backupFile}"`;

    exec(importCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error al importar: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`⚠️ ${stderr}`);
        }
        
        console.log('✅ Base de datos importada a LOCAL\n');

        // 3. Descargar imágenes
        console.log('📸 PASO 3: Descargando imágenes...\n');
        
        const imagenesCmd = 'node descargar-imagenes.js';
        
        exec(imagenesCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error al descargar imágenes: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`⚠️ ${stderr}`);
            }
            
            console.log(stdout);
            console.log('✅ ==========================================');
            console.log('✅ ¡SINCRONIZACIÓN COMPLETADA!');
            console.log('✅ ==========================================');
            console.log(`\n📁 Backup guardado en: ${backupFile}`);
            console.log('💡 Ya puedes trabajar en local con todos los datos e imágenes');
        });
    });
});