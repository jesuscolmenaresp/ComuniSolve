// subir-local-nube.js
// ================================================
// SCRIPT PARA SUBIR DE LOCAL A NUBE (TiDB)
// USO: npm run push-to-production
// ================================================

const { exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 ==========================================');
console.log('🚀 SUBIR DE LOCAL A PRODUCCIÓN (TiDB)');
console.log('🚀 ==========================================\n');
console.log('⚠️  ¡ATENCIÓN! Esto SOBRESCRIBIRÁ los datos en la nube');
console.log('⚠️  Asegúrate de que los datos en local son los correctos\n');

rl.question('¿Estás seguro de continuar? (escribe "SI" para confirmar): ', (respuesta) => {
    if (respuesta.toUpperCase() !== 'SI') {
        console.log('❌ Operación cancelada');
        rl.close();
        return;
    }

    console.log('\n📤 Exportando desde LOCAL...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = `C:\\backups\\local_to_nube_${timestamp}.sql`;

    // Crear carpeta de backups
    if (!fs.existsSync('C:\\backups')) {
        fs.mkdirSync('C:\\backups', { recursive: true });
    }

    // 1. Exportar desde LOCAL
    const exportCmd = `mysqldump --host=localhost --port=3306 --user=root --password=12345hola --databases comunisolve_db --single-transaction --skip-lock-tables --result-file="${backupFile}"`;

    exec(exportCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error al exportar: ${error.message}`);
            rl.close();
            return;
        }
        if (stderr) {
            console.log(`⚠️ ${stderr}`);
        }

        console.log(`✅ Base de datos exportada: ${backupFile}\n`);

        // 2. Importar a NUBE (TiDB)
        console.log('📤 Subiendo a NUBE (TiDB)...');
        console.log('   (Esto puede tomar unos minutos)\n');

        const importCmd = `mysql --host=gateway01.us-west-2.prod.aws.tidbcloud.com --port=4000 --user=3LKodnGRMSm39XZ.root --password=s87ZuigL2kx0fYdZ < "${backupFile}"`;

        exec(importCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error al importar a nube: ${error.message}`);
                rl.close();
                return;
            }
            if (stderr) {
                console.log(`⚠️ ${stderr}`);
            }

            console.log('✅ ==========================================');
            console.log('✅ ¡DATOS SUBIDOS A NUBE EXITOSAMENTE!');
            console.log('✅ ==========================================');
            console.log(`\n📁 Backup guardado en: ${backupFile}`);
            console.log('🌐 Verifica en: https://comunisolve.onrender.com');
            
            // Preguntar si también quiere subir imágenes
            rl.question('\n¿Quieres subir también las imágenes a Render? (s/n): ', (subirImagenes) => {
                if (subirImagenes.toLowerCase() === 's') {
                    console.log('\n📸 Para subir imágenes a Render:');
                    console.log('1. Sube las imágenes a GitHub');
                    console.log('2. Render hará deploy automático');
                    console.log('3. O usa: git add public/uploads/ && git commit -m "Subir imágenes" && git push');
                }
                console.log('\n💡 Recuerda: Ahora ambas bases están sincronizadas');
                rl.close();
            });
        });
    });
});