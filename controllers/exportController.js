const db = require('../models/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// ==========================
// 📌 EXPORTAR REPORTES A EXCEL (CON FILTROS)
// ==========================
exports.exportarReportesExcel = async (req, res) => {
    try {
        // Obtener filtros de la query string
        const { estado, categoria_id, calle_id, search, fecha_desde, fecha_hasta } = req.query;
        
        let query = `
            SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
                   r.mostrar_nombre,
                   u.nombre AS reportado_por,
                   c.nombre AS calle,
                   cat.nombre AS categoria,
                   (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS votos
            FROM reportes r
            LEFT JOIN usuarios u ON r.usuario_id = u.id
            INNER JOIN calles c ON r.calle_id = c.id
            INNER JOIN categorias cat ON r.categoria_id = cat.id
            WHERE 1=1
        `;
        
        let params = [];
        
        // Aplicar filtros
        if (search && search !== '') {
            query += " AND (r.titulo LIKE ? OR r.descripcion LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        if (estado && estado !== 'todos') {
            query += " AND r.estado = ?";
            params.push(estado);
        }
        if (categoria_id && categoria_id !== 'todos') {
            query += " AND r.categoria_id = ?";
            params.push(categoria_id);
        }
        if (calle_id && calle_id !== 'todos') {
            query += " AND r.calle_id = ?";
            params.push(calle_id);
        }
        if (fecha_desde) {
            query += " AND DATE(r.fecha) >= ?";
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            query += " AND DATE(r.fecha) <= ?";
            params.push(fecha_hasta);
        }
        
        query += " ORDER BY r.fecha DESC";
        
        const [reportes] = await db.query(query, params);
        
        // Crear libro de Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ComuniSolve';
        workbook.created = new Date();
        
        // Hoja de reportes
        const worksheet = workbook.addWorksheet('Reportes');
        
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Título', key: 'titulo', width: 35 },
            { header: 'Descripción', key: 'descripcion', width: 50 },
            { header: 'Categoría', key: 'categoria', width: 15 },
            { header: 'Calle', key: 'calle', width: 25 },
            { header: 'Reportado por', key: 'reportado_por', width: 20 },
            { header: 'Votos', key: 'votos', width: 8 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Fecha', key: 'fecha', width: 20 }
        ];
        
        worksheet.getRow(1).font = { bold: true };
        
        reportes.forEach(r => {
            worksheet.addRow({
                id: r.id,
                titulo: r.titulo,
                descripcion: r.descripcion,
                categoria: r.categoria,
                calle: r.calle,
                reportado_por: r.mostrar_nombre ? (r.reportado_por || 'Anónimo') : 'Anónimo',
                votos: r.votos || 0,
                estado: r.estado,
                fecha: new Date(r.fecha).toLocaleString()
            });
        });
        
        // Hoja de resumen con filtros aplicados
        const summarySheet = workbook.addWorksheet('Resumen');
        summarySheet.addRow(['REPORTE DE ESTADÍSTICAS']);
        summarySheet.addRow([]);
        summarySheet.addRow([`Fecha de exportación: ${new Date().toLocaleString()}`]);
        summarySheet.addRow([]);
        
        // Mostrar filtros aplicados
        summarySheet.addRow(['FILTROS APLICADOS:']);
        if (estado && estado !== 'todos') summarySheet.addRow(['Estado', estado]);
        if (categoria_id && categoria_id !== 'todos') summarySheet.addRow(['Categoría ID', categoria_id]);
        if (calle_id && calle_id !== 'todos') summarySheet.addRow(['Calle ID', calle_id]);
        if (search) summarySheet.addRow(['Búsqueda', search]);
        if (fecha_desde) summarySheet.addRow(['Fecha desde', fecha_desde]);
        if (fecha_hasta) summarySheet.addRow(['Fecha hasta', fecha_hasta]);
        summarySheet.addRow([]);
        
        const pendientes = reportes.filter(r => r.estado === 'Pendiente').length;
        const enProgreso = reportes.filter(r => r.estado === 'En Progreso').length;
        const resueltos = reportes.filter(r => r.estado === 'Resuelto').length;
        
        summarySheet.addRow(['RESUMEN POR ESTADO:']);
        summarySheet.addRow(['Pendiente', pendientes]);
        summarySheet.addRow(['En Progreso', enProgreso]);
        summarySheet.addRow(['Resuelto', resueltos]);
        summarySheet.addRow(['Total', reportes.length]);
        summarySheet.addRow([]);
        
        const categorias = {};
        reportes.forEach(r => {
            categorias[r.categoria] = (categorias[r.categoria] || 0) + 1;
        });
        
        summarySheet.addRow(['RESUMEN POR CATEGORÍA:']);
        Object.entries(categorias).forEach(([cat, total]) => {
            summarySheet.addRow([cat, total]);
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=reportes_${Date.now()}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al exportar reportes');
    }
};

// ==========================
// 📌 EXPORTAR REPORTES A PDF (CON FILTROS)
// ==========================
exports.exportarReportesPDF = async (req, res) => {
    try {
        const { estado, categoria_id, calle_id, search, fecha_desde, fecha_hasta } = req.query;
        
        let query = `
            SELECT r.id, r.titulo, r.descripcion, r.fecha, r.estado,
                   r.mostrar_nombre,
                   u.nombre AS reportado_por,
                   c.nombre AS calle,
                   cat.nombre AS categoria,
                   (SELECT COUNT(*) FROM votos v WHERE v.reporte_id = r.id) AS votos
            FROM reportes r
            LEFT JOIN usuarios u ON r.usuario_id = u.id
            INNER JOIN calles c ON r.calle_id = c.id
            INNER JOIN categorias cat ON r.categoria_id = cat.id
            WHERE 1=1
        `;
        
        let params = [];
        
        if (search && search !== '') {
            query += " AND (r.titulo LIKE ? OR r.descripcion LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        if (estado && estado !== 'todos') {
            query += " AND r.estado = ?";
            params.push(estado);
        }
        if (categoria_id && categoria_id !== 'todos') {
            query += " AND r.categoria_id = ?";
            params.push(categoria_id);
        }
        if (calle_id && calle_id !== 'todos') {
            query += " AND r.calle_id = ?";
            params.push(calle_id);
        }
        if (fecha_desde) {
            query += " AND DATE(r.fecha) >= ?";
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            query += " AND DATE(r.fecha) <= ?";
            params.push(fecha_hasta);
        }
        
        query += " ORDER BY r.fecha DESC";
        
        const [reportes] = await db.query(query, params);
        
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=reportes_${Date.now()}.pdf`);
        
        doc.pipe(res);
        
        // Encabezado
        doc.fontSize(20).font('Helvetica-Bold').text('COMUNISOLVE - REPORTE DE INCIDENCIAS', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Fecha de exportación: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();
        
        // Filtros aplicados
        doc.fontSize(10).font('Helvetica-Bold').text('Filtros aplicados:');
        doc.fontSize(9).font('Helvetica');
        if (estado && estado !== 'todos') doc.text(`• Estado: ${estado}`);
        if (categoria_id && categoria_id !== 'todos') doc.text(`• Categoría ID: ${categoria_id}`);
        if (calle_id && calle_id !== 'todos') doc.text(`• Calle ID: ${calle_id}`);
        if (search) doc.text(`• Búsqueda: ${search}`);
        if (fecha_desde) doc.text(`• Desde: ${fecha_desde}`);
        if (fecha_hasta) doc.text(`• Hasta: ${fecha_hasta}`);
        doc.moveDown();
        
        // Línea separadora
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        
        // Resumen
        const pendientes = reportes.filter(r => r.estado === 'Pendiente').length;
        const enProgreso = reportes.filter(r => r.estado === 'En Progreso').length;
        const resueltos = reportes.filter(r => r.estado === 'Resuelto').length;
        
        doc.fontSize(12).font('Helvetica-Bold').text('RESUMEN GENERAL');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total de reportes: ${reportes.length}`);
        doc.text(`Pendientes: ${pendientes}`);
        doc.text(`En Progreso: ${enProgreso}`);
        doc.text(`Resueltos: ${resueltos}`);
        doc.moveDown();
        
        // Totales por categoría
        const categorias = {};
        reportes.forEach(r => {
            categorias[r.categoria] = (categorias[r.categoria] || 0) + 1;
        });
        
        doc.fontSize(10).font('Helvetica-Bold').text('Reportes por Categoría:');
        doc.fontSize(9).font('Helvetica');
        Object.entries(categorias).forEach(([cat, total]) => {
            doc.text(`• ${cat}: ${total} reportes`);
        });
        doc.moveDown();
        
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        
        // Lista de reportes
        doc.fontSize(12).font('Helvetica-Bold').text('LISTA DE REPORTES');
        doc.moveDown(0.5);
        
        for (const r of reportes) {
            doc.fontSize(10).font('Helvetica-Bold').text(r.titulo, { underline: true });
            doc.fontSize(9).font('Helvetica');
            doc.text(`Descripción: ${r.descripcion}`);
            doc.text(`Categoría: ${r.categoria}`);
            doc.text(`Calle: ${r.calle}`);
            doc.text(`Reportado por: ${r.mostrar_nombre ? (r.reportado_por || 'Anónimo') : 'Anónimo'}`);
            doc.text(`Votos: ${r.votos || 0}`);
            doc.text(`Estado: ${r.estado}`);
            doc.text(`Fecha: ${new Date(r.fecha).toLocaleString()}`);
            doc.moveDown(0.5);
            
            if (doc.y > 700) {
                doc.addPage();
                doc.fontSize(10).font('Helvetica-Bold').text('Continuación...', { align: 'center' });
                doc.moveDown();
            }
        }
        
        doc.end();
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al exportar reportes a PDF');
    }
};

// ==========================
// 📌 EXPORTAR VOLUNTARIOS A EXCEL
// ==========================
exports.exportarVoluntariosExcel = async (req, res) => {
    try {
        const { estado } = req.query;
        
        let query = `
            SELECT v.id, v.nombre, v.telefono, v.habilidad, v.experiencia, 
                   v.disponibilidad_horaria, v.estado, v.fecha_solicitud,
                   u.email
            FROM voluntarios v
            INNER JOIN usuarios u ON v.usuario_id = u.id
            WHERE 1=1
        `;
        let params = [];
        
        if (estado && estado !== 'todos') {
            query += " AND v.estado = ?";
            params.push(estado);
        }
        
        query += " ORDER BY v.fecha_solicitud DESC";
        
        const [voluntarios] = await db.query(query, params);
        
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ComuniSolve';
        
        const worksheet = workbook.addWorksheet('Voluntarios');
        
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Nombre', key: 'nombre', width: 30 },
            { header: 'Email', key: 'email', width: 35 },
            { header: 'Teléfono', key: 'telefono', width: 15 },
            { header: 'Habilidad', key: 'habilidad', width: 30 },
            { header: 'Experiencia', key: 'experiencia', width: 40 },
            { header: 'Disponibilidad', key: 'disponibilidad_horaria', width: 25 },
            { header: 'Estado', key: 'estado', width: 12 },
            { header: 'Fecha Solicitud', key: 'fecha_solicitud', width: 20 }
        ];
        
        worksheet.getRow(1).font = { bold: true };
        
        voluntarios.forEach(v => {
            worksheet.addRow({
                id: v.id,
                nombre: v.nombre,
                email: v.email,
                telefono: v.telefono || '—',
                habilidad: v.habilidad,
                experiencia: v.experiencia || '—',
                disponibilidad_horaria: v.disponibilidad_horaria || '—',
                estado: v.estado === 'aprobado' ? 'Aprobado' : v.estado === 'pendiente' ? 'Pendiente' : 'Rechazado',
                fecha_solicitud: new Date(v.fecha_solicitud).toLocaleString()
            });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=voluntarios_${Date.now()}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al exportar voluntarios');
    }
};

// ==========================
// 📌 EXPORTAR AUDITORÍA A EXCEL (CON FILTROS)
// ==========================
exports.exportarAuditoriaExcel = async (req, res) => {
    try {
        const { usuario, accion, tabla, fecha_desde, fecha_hasta } = req.query;
        
        let query = `
            SELECT a.*, u.nombre as usuario_nombre
            FROM auditoria a
            INNER JOIN usuarios u ON a.usuario_id = u.id
            WHERE 1=1
        `;
        let params = [];
        
        if (usuario && usuario !== '') {
            query += " AND u.nombre LIKE ?";
            params.push(`%${usuario}%`);
        }
        if (accion && accion !== 'todos') {
            query += " AND a.accion = ?";
            params.push(accion);
        }
        if (tabla && tabla !== 'todos') {
            query += " AND a.tabla = ?";
            params.push(tabla);
        }
        if (fecha_desde) {
            query += " AND DATE(a.fecha) >= ?";
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            query += " AND DATE(a.fecha) <= ?";
            params.push(fecha_hasta);
        }
        
        query += " ORDER BY a.fecha DESC";
        
        const [registros] = await db.query(query, params);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Auditoria');
        
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Fecha', key: 'fecha', width: 20 },
            { header: 'Usuario', key: 'usuario_nombre', width: 25 },
            { header: 'Acción', key: 'accion', width: 15 },
            { header: 'Tabla', key: 'tabla', width: 15 },
            { header: 'Registro ID', key: 'registro_id', width: 10 },
            { header: 'Datos Anteriores', key: 'datos_anteriores', width: 40 },
            { header: 'Datos Nuevos', key: 'datos_nuevos', width: 40 }
        ];
        
        worksheet.getRow(1).font = { bold: true };
        
        registros.forEach(r => {
            worksheet.addRow({
                id: r.id,
                fecha: new Date(r.fecha).toLocaleString(),
                usuario_nombre: r.usuario_nombre,
                accion: r.accion,
                tabla: r.tabla,
                registro_id: r.registro_id,
                datos_anteriores: r.datos_anteriores || '—',
                datos_nuevos: r.datos_nuevos || '—'
            });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=auditoria_${Date.now()}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al exportar auditoría');
    }
};
// ==========================
// 📌 EXPORTAR AUDITORÍA A PDF (CON FILTROS)
// ==========================
exports.exportarAuditoriaPDF = async (req, res) => {
    try {
        const { usuario, accion, tabla, fecha_desde, fecha_hasta } = req.query;
        
        let query = `
            SELECT a.*, u.nombre as usuario_nombre
            FROM auditoria a
            INNER JOIN usuarios u ON a.usuario_id = u.id
            WHERE 1=1
        `;
        let params = [];
        
        if (usuario && usuario !== '') {
            query += " AND u.nombre LIKE ?";
            params.push(`%${usuario}%`);
        }
        if (accion && accion !== 'todos') {
            query += " AND a.accion = ?";
            params.push(accion);
        }
        if (tabla && tabla !== 'todos') {
            query += " AND a.tabla = ?";
            params.push(tabla);
        }
        if (fecha_desde) {
            query += " AND DATE(a.fecha) >= ?";
            params.push(fecha_desde);
        }
        if (fecha_hasta) {
            query += " AND DATE(a.fecha) <= ?";
            params.push(fecha_hasta);
        }
        
        query += " ORDER BY a.fecha DESC LIMIT 500";
        
        const [registros] = await db.query(query, params);
        
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=auditoria_${Date.now()}.pdf`);
        
        doc.pipe(res);
        
        // Encabezado
        doc.fontSize(20).font('Helvetica-Bold').text('COMUNISOLVE - REGISTRO DE AUDITORÍA', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica').text(`Fecha de exportación: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();
        
        // Filtros aplicados
        doc.fontSize(10).font('Helvetica-Bold').text('Filtros aplicados:');
        doc.fontSize(9).font('Helvetica');
        if (usuario) doc.text(`• Usuario: ${usuario}`);
        if (accion && accion !== 'todos') doc.text(`• Acción: ${accion}`);
        if (tabla && tabla !== 'todos') doc.text(`• Tabla: ${tabla}`);
        if (fecha_desde) doc.text(`• Desde: ${fecha_desde}`);
        if (fecha_hasta) doc.text(`• Hasta: ${fecha_hasta}`);
        doc.moveDown();
        
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        
        // Tabla de auditoría
        doc.fontSize(10).font('Helvetica-Bold').text('REGISTROS:');
        doc.moveDown(0.5);
        
        for (const r of registros) {
            doc.fontSize(9).font('Helvetica-Bold').text(`ID: ${r.id}`, { underline: true });
            doc.fontSize(8).font('Helvetica');
            doc.text(`Fecha: ${new Date(r.fecha).toLocaleString()}`);
            doc.text(`Usuario: ${r.usuario_nombre}`);
            doc.text(`Acción: ${r.accion}`);
            doc.text(`Tabla: ${r.tabla}`);
            doc.text(`Registro ID: ${r.registro_id || '—'}`);
            doc.moveDown(0.5);
            
            if (doc.y > 700) {
                doc.addPage();
                doc.fontSize(9).font('Helvetica-Bold').text('Continuación...', { align: 'center' });
                doc.moveDown();
            }
        }
        
        doc.end();
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al exportar auditoría a PDF');
    }
};