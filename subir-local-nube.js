// subir-local-nube.js
// ================================================
// SCRIPT PARA SUBIR DE LOCAL A NUBE (TiDB)
// USO: node subir-local-nube.js
// ================================================

const { exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ========== CONFIGURACIÓN ==========
// Cambia esta ruta según donde tengas instalado MySQL
// Común en XAMPP: C:\xampp\mysql\bin
// Común en WAMP: C:\wamp64\bin\mysql\mysql5.7.31\bin
// Común en MySQL standalone: C:\Program Files\MySQL\MySQL Server 8.0\bin
const MYSQL_PATH = 'C:\\xampp\\mysql\\bin';  // <--- CAMBIA ESTO SEGÚN TU INSTALACIÓN
// ====================================

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

    // Ruta completa de mysqldump
    const mysqldump = `${MYSQL_PATH}\\mysqldump.exe`;
    const mysql = `${MYSQL_PATH}\\mysql.exe`;

    // 1. Exportar desde LOCAL
    const exportCmd = `"${mysqldump}" --host=localhost --port=3306 --user=root --password=12345hola --databases comunisolve_db --single-transaction --skip-lock-tables --result-file="${backupFile}"`;

    console.log(`📂 Usando: ${mysqldump}`);
    console.log('⏳ Exportando... (puede tomar unos segundos)\n');

    exec(exportCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error al exportar: ${error.message}`);
            console.log('\n💡 Si el error persiste, verifica que:');
            console.log('   1. MySQL está instalado en: ' + MYSQL_PATH);
            console.log('   2. Las credenciales son correctas');
            console.log('   3. El servicio MySQL está corriendo');
            rl.close();
            return;
        }
        if (stderr) {
            console.log(`⚠️ ${stderr}`);
        }

        console.log(`✅ Base de datos exportada: ${backupFile}\n`);

        // Verificar que el archivo no esté vacío
        const stats = fs.statSync(backupFile);
        if (stats.size < 100) {
            console.log('❌ El archivo exportado es muy pequeño. Algo salió mal.');
            console.log('   Verifica que la base de datos local tenga datos.');
            rl.close();
            return;
        }

        console.log(`📊 Tamaño del backup: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        // 2. Importar a NUBE (TiDB)
        console.log('\n📤 Subiendo a NUBE (TiDB)...');
        console.log('   (Esto puede tomar varios minutos dependiendo del tamaño)\n');

        // Leer el archivo y filtrar líneas problemáticas para TiDB
        console.log('🔧 Procesando archivo para compatibilidad con TiDB...');
        let sqlContent = fs.readFileSync(backupFile, 'utf8');
        
        // Reemplazar ENGINE=InnoDB por ENGINE=InnoDB (TiDB es compatible)
        // TiDB no soporta algunas opciones de MySQL
        sqlContent = sqlContent.replace(/ENGINE=InnoDB/g, 'ENGINE=InnoDB');
        sqlContent = sqlContent.replace(/AUTO_INCREMENT=\d+/g, '');
        
        // Guardar versión procesada
        const processedFile = backupFile.replace('.sql', '_processed.sql');
        fs.writeFileSync(processedFile, sqlContent);
        console.log(`✅ Archivo procesado: ${processedFile}`);

        const importCmd = `"${mysql}" --host=gateway01.us-west-2.prod.aws.tidbcloud.com --port=4000 --user=3LKodnGRMSm39XZ.root --password=s87ZuigL2kx0fYdZ < "${processedFile}"`;

        exec(importCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error al importar a nube: ${error.message}`);
                console.log('\n💡 Posibles causas:');
                console.log('   1. La conexión a TiDB está caída');
                console.log('   2. Las credenciales de TiDB son incorrectas');
                console.log('   3. La base de datos en la nube ya tiene datos conflictivos');
                console.log('\n📝 Para solucionar:');
                console.log('   1. Verifica tu conexión a internet');
                console.log('   2. Revisa las credenciales en el archivo .env.production');
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
            console.log(`📁 Backup procesado en: ${processedFile}`);
            console.log('🌐 Verifica en: https://comunisolve.onrender.com');
            
            // Preguntar si también quiere subir imágenes
            rl.question('\n📸 ¿Quieres subir también las imágenes a la nube? (s/n): ', (subirImagenes) => {
                if (subirImagenes.toLowerCase() === 's') {
                    console.log('\n📸 Para subir imágenes a la nube:');
                    console.log('   Opción 1 (GitHub):');
                    console.log('   git add public/uploads/');
                    console.log('   git commit -m "Subir imágenes"');
                    console.log('   git push origin main');
                    console.log('\n   Opción 2 (Render):');
                    console.log('   Usa el almacenamiento persistente de Render');
                    console.log('   o sube manualmente desde el dashboard de Render');
                }
                console.log('\n💡 Recuerda: Las bases de datos están sincronizadas');
                console.log('🔄 Si usaste el backup procesado, puedes eliminar: ' + processedFile);
                rl.close();
            });
        });
    });
});