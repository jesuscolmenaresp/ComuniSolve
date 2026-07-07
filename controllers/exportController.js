const db = require('../models/db');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { format } = require('date-fns');

// ==========================
// 📌 EXPORTAR REPORTES A EXCEL (CON FILTROS Y MEJORAS)
// ==========================
exports.exportarReportesExcel = async (req, res) => {
    try {
        const usuario = req.session.usuario;
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
            WHERE r.activo = 1
        `;
        
        let params = [];

        // Filtros por rol
        if (usuario) {
            if (usuario.rol_id === 4) {
                query += " AND r.usuario_id = ?";
                params.push(usuario.id);
            } else if (usuario.rol_id === 3) {
                if (usuario.calle_id) {
                    query += " AND r.calle_id = ?";
                    params.push(usuario.calle_id);
                } else {
                    query += " AND 1=0";
                }
            } else if (usuario.rol_id === 2) {
                query += " AND r.calle_id IN (SELECT id FROM calles WHERE lider_id = ?)";
                params.push(usuario.id);
            } else if (usuario.rol_id === 1) {
                query += ` AND r.calle_id IN (
                    SELECT c.id 
                    FROM calles c 
                    INNER JOIN comunidades com ON c.comunidad_id = com.id
                    INNER JOIN ubch_comunidades uc ON uc.comunidad_id = com.id
                    WHERE uc.ubch_id = ?
                )`;
                params.push(usuario.id);
            }
        }
        
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
        
        // Estilos de cabecera
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FD6704BD' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
        
        worksheet.columns = [
            { header: 'Título', key: 'titulo', width: 40 },
            { header: 'Descripción', key: 'descripcion', width: 50 },
            { header: 'Categoría', key: 'categoria', width: 20 },
            { header: 'Calle', key: 'calle', width: 25 },
            { header: 'Reportado por', key: 'reportado_por', width: 20 },
            { header: 'Votos', key: 'votos', width: 10 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Fecha', key: 'fecha', width: 20 }
        ];
        
        worksheet.getRow(1).eachCell((cell) => {
            Object.assign(cell, headerStyle);
        });
        
        reportes.forEach((r, index) => {
            const row = worksheet.addRow({
                titulo: r.titulo,
                descripcion: r.descripcion || '',
                categoria: r.categoria,
                calle: r.calle,
                reportado_por: r.mostrar_nombre ? (r.reportado_por || 'Anónimo') : 'Anónimo',
                votos: r.votos || 0,
                estado: r.estado,
                fecha: format(new Date(r.fecha), 'dd/MM/yyyy HH:mm')
            });
            
            if (index % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0EB' } };
                });
            }
            
            const estadoColors = {
                'Pendiente': 'FFC107',
                'En Progreso': '17A2B8',
                'Resuelto': '28A745'
            };
            const estadoCell = row.getCell('estado');
            estadoCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: estadoColors[r.estado] || '6C757D' }
            };
            estadoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });
        
        // Hoja de resumen
        const summarySheet = workbook.addWorksheet('Resumen');
        const titleRow = summarySheet.addRow(['COMUNISOLVE - REPORTE DE INCIDENCIAS']);
        titleRow.font = { bold: true, size: 16 };
        summarySheet.addRow([]);
        summarySheet.addRow([`Fecha de exportación: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]);
        summarySheet.addRow([]);
        
        summarySheet.addRow(['FILTROS APLICADOS:']);
        summarySheet.addRow(['']);
        if (estado && estado !== 'todos') summarySheet.addRow(['Estado', estado]);
        if (categoria_id && categoria_id !== 'todos') {
            const [cat] = await db.query('SELECT nombre FROM categorias WHERE id = ?', [categoria_id]);
            summarySheet.addRow(['Categoría', cat.length > 0 ? cat[0].nombre : categoria_id]);
        }
        if (calle_id && calle_id !== 'todos') {
            const [calle] = await db.query('SELECT nombre FROM calles WHERE id = ?', [calle_id]);
            summarySheet.addRow(['Calle', calle.length > 0 ? calle[0].nombre : calle_id]);
        }
        if (search) summarySheet.addRow(['Búsqueda', search]);
        if (fecha_desde) summarySheet.addRow(['Fecha desde', fecha_desde]);
        if (fecha_hasta) summarySheet.addRow(['Fecha hasta', fecha_hasta]);
        summarySheet.addRow([]);
        
        const pendientes = reportes.filter(r => r.estado === 'Pendiente').length;
        const enProgreso = reportes.filter(r => r.estado === 'En Progreso').length;
        const resueltos = reportes.filter(r => r.estado === 'Resuelto').length;
        
        summarySheet.addRow(['RESUMEN POR ESTADO:']);
        summarySheet.addRow(['Estado', 'Cantidad']);
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
        summarySheet.addRow(['Categoría', 'Cantidad']);
        Object.entries(categorias).forEach(([cat, total]) => {
            summarySheet.addRow([cat, total]);
        });
        
        summarySheet.getColumn(1).width = 30;
        summarySheet.getColumn(2).width = 20;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=reportes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('Error exportando Excel:', err);
        res.status(500).send('Error al exportar reportes a Excel');
    }
};

// ==========================
// 📌 EXPORTAR REPORTES A PDF (SIN PIE DE PÁGINA)
// ==========================
exports.exportarReportesPDF = async (req, res) => {
    try {
        const usuario = req.session.usuario;
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
            WHERE r.activo = 1
        `;
        
        let params = [];

        // Filtros por rol
        if (usuario) {
            if (usuario.rol_id === 4) {
                query += " AND r.usuario_id = ?";
                params.push(usuario.id);
            } else if (usuario.rol_id === 3) {
                if (usuario.calle_id) {
                    query += " AND r.calle_id = ?";
                    params.push(usuario.calle_id);
                } else {
                    query += " AND 1=0";
                }
            } else if (usuario.rol_id === 2) {
                query += " AND r.calle_id IN (SELECT id FROM calles WHERE lider_id = ?)";
                params.push(usuario.id);
            } else if (usuario.rol_id === 1) {
                query += ` AND r.calle_id IN (
                    SELECT c.id 
                    FROM calles c 
                    INNER JOIN comunidades com ON c.comunidad_id = com.id
                    INNER JOIN ubch_comunidades uc ON uc.comunidad_id = com.id
                    WHERE uc.ubch_id = ?
                )`;
                params.push(usuario.id);
            }
        }
        
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
        
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            info: {
                Title: 'Reporte de Incidencias',
                Author: 'ComuniSolve',
                Subject: 'Reporte de incidencias'
            },
            autoFirstPage: true,
            bufferPages: true
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=reportes_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        
        doc.pipe(res);
        
        const pageWidth = doc.page.width - 100;

        // ============================================================
        // 📌 ENCABEZADO
        // ============================================================
        function dibujarEncabezado() {
            const y = 30;
            doc.rect(50, y, pageWidth, 3).fillColor('#5D4037').fill();
            
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#5D4037')
               .text('ComuniSolve', 50, y + 15, { align: 'center' });
            doc.fontSize(11).font('Helvetica').fillColor('#6c757d')
               .text('Reporte de Incidencias', { align: 'center' });
            doc.fontSize(8).font('Helvetica').fillColor('#8B6B5A')
               .text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, { align: 'center' });
            
            doc.rect(50, doc.y + 4, pageWidth, 1).fillColor('#e0d5c8').fill();
            return doc.y + 12;
        }

        let currentY = dibujarEncabezado();

        // ============================================================
        // 📌 FILTROS APLICADOS
        // ============================================================
        let filtrosInfo = [];
        if (estado && estado !== 'todos') filtrosInfo.push(`Estado: ${estado}`);
        if (categoria_id && categoria_id !== 'todos') {
            const [cat] = await db.query('SELECT nombre FROM categorias WHERE id = ?', [categoria_id]);
            if (cat.length > 0) filtrosInfo.push(`Categoría: ${cat[0].nombre}`);
        }
        if (calle_id && calle_id !== 'todos') {
            const [calle] = await db.query('SELECT nombre FROM calles WHERE id = ?', [calle_id]);
            if (calle.length > 0) filtrosInfo.push(`Calle: ${calle[0].nombre}`);
        }
        if (search) filtrosInfo.push(`Búsqueda: "${search}"`);
        if (fecha_desde) filtrosInfo.push(`Desde: ${fecha_desde}`);
        if (fecha_hasta) filtrosInfo.push(`Hasta: ${fecha_hasta}`);
        
        if (filtrosInfo.length > 0) {
            doc.fontSize(7).font('Helvetica-Oblique').fillColor('#6c757d')
               .text(`Filtros aplicados: ${filtrosInfo.join(' • ')}`, { align: 'center' });
            currentY = doc.y + 15;
        } else {
            currentY += 5;
        }

        // ============================================================
        // 📌 RESUMEN GENERAL (Estilo Tarjetas)
        // ============================================================
        const pendientes = reportes.filter(r => r.estado === 'Pendiente').length;
        const enProgreso = reportes.filter(r => r.estado === 'En Progreso').length;
        const resueltos = reportes.filter(r => r.estado === 'Resuelto').length;
        
        // Caja contenedora sutil
        doc.rect(50, currentY, pageWidth, 45)
           .lineWidth(1).strokeColor('#e0d5c8').stroke();
        doc.rect(50, currentY, pageWidth, 45).fillColor('#faf8f6').fill();
        
        // Título interno
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#5D4037')
           .text('RESUMEN DE ESTADOS', 60, currentY + 6);
        
        const statY = currentY + 22;
        
        // Total
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#4a3728')
           .text('TOTAL:', 60, statY);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#5D4037')
           .text(reportes.length.toString(), 95, statY - 1);
           
        // Pendientes
        doc.rect(150, statY - 2, 8, 8).fillColor('#ffc107').fill();
        doc.fontSize(8).font('Helvetica').fillColor('#4a3728')
           .text(`Pendientes: ${pendientes}`, 165, statY);
           
        // En Progreso
        doc.rect(260, statY - 2, 8, 8).fillColor('#17a2b8').fill();
        doc.fontSize(8).font('Helvetica').fillColor('#4a3728')
           .text(`En Progreso: ${enProgreso}`, 275, statY);
           
        // Resueltos
        doc.rect(380, statY - 2, 8, 8).fillColor('#28a745').fill();
        doc.fontSize(8).font('Helvetica').fillColor('#4a3728')
           .text(`Resueltos: ${resueltos}`, 395, statY);
        
        currentY += 65;

        // ============================================================
        // 📌 LISTA DE REPORTES
        // ============================================================
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#5D4037')
           .text('Detalle de Incidencias', 50, currentY);
        currentY = doc.y + 6;
        
        const colWidths = [120, 100, 95, 45, 75, 60];
        const colPositions = [50];
        for (let i = 1; i < colWidths.length; i++) {
            colPositions.push(colPositions[i-1] + colWidths[i-1]);
        }
        const rowHeight = 24; 
        let itemCount = 0;
        
        function dibujarCabecerasReportes() {
            doc.rect(50, currentY, pageWidth, rowHeight)
               .fillColor('#5D4037').fill()
               .fillColor('white');
            
            const headers = ['Título', 'Categoría', 'Calle', 'Votos', 'Estado', 'Fecha'];
            doc.fontSize(8).font('Helvetica-Bold');
            colPositions.forEach((x, i) => {
                doc.text(headers[i], x + 5, currentY + 7, { width: colWidths[i] - 10, align: 'center' });
            });
            currentY += rowHeight;
        }

        dibujarCabecerasReportes();
        
        for (const r of reportes) {
            itemCount++;
            const fillColor = itemCount % 2 === 0 ? '#faf8f6' : '#ffffff';
            
            // Verificamos si hay espacio para la fila (Margen seguro)
            if (currentY + rowHeight > doc.page.height - 60) {
                doc.addPage();
                currentY = dibujarEncabezado() + 10;
                dibujarCabecerasReportes();
            }
            
            // Fila
            doc.rect(50, currentY, pageWidth, rowHeight).fillColor(fillColor).fill();
            
            // Línea separadora sutil inferior
            doc.rect(50, currentY + rowHeight, pageWidth, 0.5).fillColor('#e0d5c8').fill();
            
            doc.fillColor('#4a3728').fontSize(7).font('Helvetica');
            
            // Título
            doc.text(r.titulo, colPositions[0] + 5, currentY + 7, { 
                width: colWidths[0] - 10, 
                lineBreak: false, 
                ellipsis: true 
            });
            
            // Categoría
            doc.text(r.categoria, colPositions[1] + 5, currentY + 7, { 
                width: colWidths[1] - 10, 
                align: 'center', 
                lineBreak: false, 
                ellipsis: true 
            });
            
            // Calle
            doc.text(r.calle, colPositions[2] + 5, currentY + 7, { 
                width: colWidths[2] - 10, 
                align: 'center', 
                lineBreak: false, 
                ellipsis: true 
            });
            
            // Votos
            doc.font('Helvetica-Bold')
               .text((r.votos || 0).toString(), colPositions[3] + 5, currentY + 7, { 
                    width: colWidths[3] - 10, 
                    align: 'center' 
                });
            doc.font('Helvetica');
            
            // Estado (con badge estilizado)
            const estadoColors = {
                'Pendiente': '#ffc107',
                'En Progreso': '#17a2b8',
                'Resuelto': '#28a745'
            };
            const estadoColor = estadoColors[r.estado] || '#6c757d';
            const badgeWidth = 50;
            const badgeX = colPositions[4] + (colWidths[4] - badgeWidth) / 2;
            
            doc.rect(badgeX, currentY + 5, badgeWidth, 13)
               .fillColor(estadoColor).fill();
            
            const textColor = r.estado === 'Pendiente' ? '#4a3728' : 'white';
            
            doc.fillColor(textColor)
               .fontSize(6)
               .font('Helvetica-Bold')
               .text(r.estado.toUpperCase(), badgeX, currentY + 8.5, { 
                   width: badgeWidth, 
                   align: 'center' 
               });
            
            // Fecha
            doc.fontSize(7).font('Helvetica').fillColor('#8B6B5A')
               .text(format(new Date(r.fecha), 'dd/MM/yyyy'), colPositions[5] + 5, currentY + 7, { 
                    width: colWidths[5] - 10, 
                    align: 'center' 
                });
            
            currentY += rowHeight;
        }
        
        doc.end();
        
    } catch (err) {
        console.error('Error exportando PDF:', err);
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
        worksheet.getRow(1).eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FD6704BD' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });
        
        voluntarios.forEach((v, index) => {
            const row = worksheet.addRow({
                nombre: v.nombre,
                email: v.email,
                telefono: v.telefono || '—',
                habilidad: v.habilidad || '—',
                experiencia: v.experiencia || '—',
                disponibilidad_horaria: v.disponibilidad_horaria || '—',
                estado: v.estado === 'aprobado' ? 'Aprobado' : v.estado === 'pendiente' ? 'Pendiente' : 'Rechazado',
                fecha_solicitud: format(new Date(v.fecha_solicitud), 'dd/MM/yyyy HH:mm')
            });
            
            if (index % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0EB' } };
                });
            }
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=voluntarios_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al exportar voluntarios');
    }
};

// ==========================
// 📌 EXPORTAR AUDITORÍA A EXCEL (CON WRAP TEXT PARA TABLAS LARGAS)
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
        
        // Ajuste de anchos para dar más espacio a los datos
        worksheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 20 },
            { header: 'Usuario', key: 'usuario_nombre', width: 25 },
            { header: 'Acción', key: 'accion', width: 20 },
            { header: 'Tabla', key: 'tabla', width: 15 },
            { header: 'Registro ID', key: 'registro_id', width: 12 },
            { header: 'Datos Anteriores', key: 'datos_anteriores', width: 45 },
            { header: 'Datos Nuevos', key: 'datos_nuevos', width: 45 }
        ];
        
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FD6704BD' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        
        registros.forEach((r, index) => {
            const row = worksheet.addRow({
                fecha: format(new Date(r.fecha), 'dd/MM/yyyy HH:mm'),
                usuario_nombre: r.usuario_nombre,
                accion: r.accion,
                tabla: r.tabla,
                registro_id: r.registro_id || '—',
                datos_anteriores: r.datos_anteriores || '—',
                datos_nuevos: r.datos_nuevos || '—'
            });
            
            // 📌 EL TRUCO ESTÁ AQUÍ: Ajustar el texto para que no se desborde y se alinee arriba
            row.alignment = { wrapText: true, vertical: 'top' };
            
            if (index % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0EB' } };
                });
            }
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=auditoria_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error(err);
        res.status(500).send('Error al exportar auditoría');
    }
};

// ==========================
// 📌 EXPORTAR AUDITORÍA A PDF (CORREGIDO Y COMPLETADO)
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
        
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            autoFirstPage: true,
            bufferPages: true
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=auditoria_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        
        doc.pipe(res);
        
        const pageWidth = doc.page.width - 100;
        
        function dibujarEncabezado() {
            const y = 30;
            doc.rect(50, y, pageWidth, 3).fillColor('#5D4037').fill();
            
            doc.fontSize(18).font('Helvetica-Bold').fillColor('#5D4037')
               .text('ComuniSolve', 50, y + 12, { align: 'center' });
            doc.fontSize(10).font('Helvetica').fillColor('#6c757d')
               .text('Registro de Auditoría', { align: 'center' });
            doc.fontSize(8).font('Helvetica').fillColor('#8B6B5A')
               .text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, { align: 'center' });
            
            doc.rect(50, doc.y + 2, pageWidth, 1).fillColor('#e0d5c8').fill();
            return doc.y + 8;
        }
        
        let yPos = dibujarEncabezado();
        yPos += 5;
        
        let filtrosInfo = [];
        if (usuario) filtrosInfo.push(`Usuario: ${usuario}`);
        if (accion && accion !== 'todos') filtrosInfo.push(`Acción: ${accion}`);
        if (tabla && tabla !== 'todos') filtrosInfo.push(`Tabla: ${tabla}`);
        if (fecha_desde) filtrosInfo.push(`Desde: ${fecha_desde}`);
        if (fecha_hasta) filtrosInfo.push(`Hasta: ${fecha_hasta}`);
        
        if (filtrosInfo.length > 0) {
            doc.fontSize(7).font('Helvetica').fillColor('#8B6B5A')
               .text(`Filtros: ${filtrosInfo.join(' | ')}`, { align: 'center' });
            yPos = doc.y + 15;
        } else {
             yPos += 10;
        }

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#5D4037')
           .text(`Registros de Auditoría (Total: ${registros.length})`, 50, yPos, { underline: true });
        yPos = doc.y + 8;
        
        // Ajuste de anchos para que sumen el ancho total (approx 495)
        const colWidths = [60, 85, 85, 60, 205];
        const colPositions = [50];
        for (let i = 1; i < colWidths.length; i++) {
            colPositions.push(colPositions[i-1] + colWidths[i-1]);
        }
        const rowHeight = 22;
        let itemCount = 0;
        
        function dibujarCabecerasTabla() {
            doc.rect(50, yPos, pageWidth, rowHeight)
               .fillColor('#5D4037').fill()
               .fillColor('white');
            
            const headers = ['Fecha', 'Usuario', 'Acción', 'Tabla', 'Cambios'];
            doc.fontSize(7).font('Helvetica-Bold');
            colPositions.forEach((x, i) => {
                doc.text(headers[i], x + 3, yPos + 6, { width: colWidths[i] - 6, align: 'center' });
            });
            yPos += rowHeight;
        }

        dibujarCabecerasTabla();
        
        // Colores para los badges de acciones en el PDF
        const coloresAcciones = {
            'CREAR': '#28a745',
            'EDITAR': '#17a2b8',
            'ELIMINAR': '#dc3545',
            'ELIMINAR_PERMANENTEMENTE': '#dc3545',
            'DESACTIVAR': '#fd7e14',
            'ACTIVAR': '#28a745',
            'ASIGNAR': '#6f42c1',
            'CAMBIAR_ESTADO': '#ffc107',
            'REAPROBAR': '#20c997',
            'ACTUALIZAR': '#6c757d'
        };

        for (const r of registros) {
            itemCount++;
            const fillColor = itemCount % 2 === 0 ? '#faf8f6' : '#ffffff';
            
            doc.rect(50, yPos, pageWidth, rowHeight)
               .fillColor(fillColor).fill()
               .fillColor('#4a3728');
            
            // 1. Fecha
            doc.fontSize(7).font('Helvetica')
               .text(format(new Date(r.fecha), 'dd/MM/yy HH:mm'), colPositions[0] + 3, yPos + 6, { width: colWidths[0] - 6, align: 'center' });
            
            // 2. Usuario
            const nomUsuario = r.usuario_nombre.length > 15 ? r.usuario_nombre.substring(0, 15) + '...' : r.usuario_nombre;
            doc.text(nomUsuario, colPositions[1] + 3, yPos + 6, { width: colWidths[1] - 6, align: 'center' });
            
            // 3. Acción (Badge)
            const estadoColor = coloresAcciones[r.accion] || '#6c757d';
            const badgeWidth = colWidths[2] - 10;
            const badgeX = colPositions[2] + 5;
            
            doc.rect(badgeX, yPos + 3, badgeWidth, 16)
               .fillColor(estadoColor).fill()
               .fillColor('white')
               .fontSize(6).font('Helvetica-Bold')
               .text(r.accion, badgeX, yPos + 8, { width: badgeWidth, align: 'center' });
            
            // 4. Tabla
            doc.fillColor('#4a3728').fontSize(7).font('Helvetica')
               .text(r.tabla, colPositions[3] + 3, yPos + 6, { width: colWidths[3] - 6, align: 'center' });
            
            // 5. Cambios (Resumidos para evitar que desborden)
            let textoCambios = '—';
            if (r.datos_nuevos) {
                textoCambios = r.datos_nuevos;
            } else if (r.datos_anteriores) {
                textoCambios = `Prev: ${r.datos_anteriores}`;
            }
            
            doc.text(textoCambios, colPositions[4] + 3, yPos + 6, { 
                width: colWidths[4] - 6, 
                align: 'left',
                height: 14,
                ellipsis: true // 📌 Esto evita que el texto invada otras columnas
            });
            
            yPos += rowHeight;
            
            // Paginación
            if (yPos > doc.page.height - 60 && itemCount < registros.length) {
                doc.addPage();
                yPos = dibujarEncabezado() + 10;
                dibujarCabecerasTabla();
            }
        }
        
        doc.end();
        
    } catch (err) {
        console.error('Error exportando PDF:', err);
        res.status(500).send('Error al exportar auditoría a PDF');
    }
};
// ==========================
// 📌 EXPORTAR AUDITORÍA A PDF (AJUSTES DE TAMAÑO Y RESUMEN MÁS ESPACIADO)
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
        
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            autoFirstPage: true,
            bufferPages: true
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=auditoria_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        
        doc.pipe(res);
        
        const pageWidth = doc.page.width - 100;
        
        // ============================================================
        // 📌 FUNCIÓN PARA DIBUJAR ENCABEZADO EN CADA PÁGINA
        // ============================================================
        function dibujarEncabezado() {
            const y = 30;
            doc.rect(50, y, pageWidth, 3).fillColor('#5D4037').fill();
            
            doc.fontSize(18).font('Helvetica-Bold').fillColor('#5D4037')
               .text('ComuniSolve', 50, y + 12, { align: 'center' });
            doc.fontSize(10).font('Helvetica').fillColor('#6c757d')
               .text('Registro de Auditoría', { align: 'center' });
            doc.fontSize(8).font('Helvetica').fillColor('#8B6B5A')
               .text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, { align: 'center' });
            
            doc.rect(50, doc.y + 2, pageWidth, 1).fillColor('#e0d5c8').fill();
            return doc.y + 8;
        }
        
        // ============================================================
        // 📌 PRIMERA PÁGINA - ENCABEZADO Y FILTROS
        // ============================================================
        let yPos = dibujarEncabezado();
        yPos += 5;
        
        // Filtros
        let filtrosInfo = [];
        if (usuario) filtrosInfo.push(`Usuario: ${usuario}`);
        if (accion && accion !== 'todos') filtrosInfo.push(`Acción: ${accion}`);
        if (tabla && tabla !== 'todos') filtrosInfo.push(`Tabla: ${tabla}`);
        if (fecha_desde) filtrosInfo.push(`Desde: ${fecha_desde}`);
        if (fecha_hasta) filtrosInfo.push(`Hasta: ${fecha_hasta}`);
        
        if (filtrosInfo.length > 0) {
            doc.fontSize(7).font('Helvetica').fillColor('#8B6B5A')
               .text(`Filtros: ${filtrosInfo.join(' | ')}`, { align: 'center' });
            yPos = doc.y + 15;
        } else {
             yPos += 10;
        }

        // ============================================================
        // 📌 TABLA DE REGISTROS (TOTAL INCLUIDO EN EL TÍTULO)
        // ============================================================
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#5D4037')
           .text(`Registros de Auditoría (Total: ${registros.length})`, 50, yPos, { underline: true });
        yPos = doc.y + 8;
        
        // Configuración de la tabla
        const colWidths = [60, 75, 90, 60, 125];
        const colPositions = [50];
        for (let i = 1; i < colWidths.length; i++) {
            colPositions.push(colPositions[i-1] + colWidths[i-1]);
        }
        const rowHeight = 18;
        let itemCount = 0;
        
        // Cabeceras
        doc.rect(50, yPos, pageWidth, rowHeight)
           .fillColor('#5D4037').fill()
           .fillColor('white');
        
        const headers = ['Fecha', 'Usuario', 'Acción', 'Tabla', 'Cambios'];
        doc.fontSize(7).font('Helvetica-Bold');
        colPositions.forEach((x, i) => {
            doc.text(headers[i], x + 3, yPos + 4, { width: colWidths[i] - 6, align: 'center' });
        });
        
        yPos += rowHeight;
        
        const acciones = {};
        const coloresAcciones = {
            'CREAR': '#28a745',
            'EDITAR': '#17a2b8',
            'ELIMINAR': '#dc3545',
            'ELIMINAR_PERMANENTEMENTE': '#dc3545',
            'DESACTIVAR': '#fd7e14',
            'ACTIVAR': '#28a745',
            'ASIGNAR': '#6f42c1',
            'CAMBIAR_ESTADO': '#ffc107',
            'REAPROBAR': '#20c997',
            'ACTUALIZAR': '#6c757d'
        };
        
        const accionesCortas = {
            'ELIMINAR_PERMANENTEMENTE': 'ELIM. PERM.',
            'CAMBIAR_ESTADO': 'CAMB. EST.',
            'DESACTIVAR': 'DESACT.',
            'ACTUALIZAR': 'ACTUAL.',
            'REAPROBAR': 'REAPR.',
            'ASIGNAR': 'ASIGNAR',
            'EDITAR': 'EDITAR',
            'CREAR': 'CREAR',
            'ELIMINAR': 'ELIMINAR',
            'ACTIVAR': 'ACTIVAR'
        };

        // Datos
        for (const r of registros) {
            itemCount++;
            acciones[r.accion] = (acciones[r.accion] || 0) + 1;

            const fillColor = itemCount % 2 === 0 ? '#faf8f6' : '#ffffff';
            
            // Verificamos salto de página (margen de 60)
            if (yPos + rowHeight > doc.page.height - 60) {
                doc.addPage();
                yPos = dibujarEncabezado() + 8;
                
                // Re-dibujar cabeceras
                doc.rect(50, yPos, pageWidth, rowHeight)
                   .fillColor('#5D4037').fill()
                   .fillColor('white');
                doc.fontSize(7).font('Helvetica-Bold');
                colPositions.forEach((x, i) => {
                    doc.text(headers[i], x + 3, yPos + 4, { width: colWidths[i] - 6, align: 'center' });
                });
                yPos += rowHeight;
            }
            
            // Fila
            const rowY = yPos;
            doc.rect(50, rowY, pageWidth, rowHeight)
               .fillColor(fillColor).fill()
               .fillColor('#4a3728');
            
            // Fecha 
            doc.fontSize(6).font('Helvetica')
               .text(format(new Date(r.fecha), 'dd/MM/yyyy'), colPositions[0] + 3, rowY + 4, { width: colWidths[0] - 6, align: 'center', lineBreak: false });
            
            // Usuario 
            const usuarioNombre = (r.usuario_nombre || 'Sistema');
            doc.text(usuarioNombre, colPositions[1] + 3, rowY + 4, { width: colWidths[1] - 6, align: 'center', lineBreak: false, ellipsis: true });
            
            // Acción
            const accColor = coloresAcciones[r.accion] || '#6c757d';
            const accionMostrar = accionesCortas[r.accion] || r.accion;
            const badgeWidth = 70;
            const accX = colPositions[2] + (colWidths[2] - badgeWidth) / 2;

            doc.rect(accX, rowY + 2, badgeWidth, 14)
               .fillColor(accColor)
               .fill();

            doc.fillColor('white')
               .fontSize(6)
               .font('Helvetica-Bold')
               .text(accionMostrar, accX + 2, rowY + 4, { width: badgeWidth - 4, align: 'center', lineBreak: false });
            
            // Tabla 
            doc.fontSize(6).fillColor('#4a3728')
               .text(r.tabla, colPositions[3] + 3, rowY + 4, { width: colWidths[3] - 6, align: 'center', lineBreak: false, ellipsis: true });
            
            // Cambios 
            let cambiosText = '—';
            if (r.datos_nuevos && r.datos_nuevos !== 'null' && r.datos_nuevos !== '{}') {
                try {
                    const datos = JSON.parse(r.datos_nuevos);
                    if (datos.motivo) cambiosText = datos.motivo;
                    else if (datos.estado) cambiosText = `Estado: ${datos.estado}`;
                    else if (datos.password) cambiosText = 'Contraseña cambiada';
                    else if (datos.empresa_nombre) cambiosText = `Empresa: ${datos.empresa_nombre}`;
                    else if (datos.archivo) cambiosText = datos.archivo || 'Ver detalles';
                    else cambiosText = 'Ver detalles';
                } catch {
                    cambiosText = 'Ver detalles';
                }
            } else if (r.datos_anteriores && r.datos_anteriores !== 'null' && r.datos_anteriores !== '{}') {
                cambiosText = 'Eliminado';
            }
            
            // AUMENTO DE TAMAÑO A LA COLUMNA "CAMBIOS" (de 5.5 a 6.5)
            doc.fontSize(6.5).fillColor('#8B6B5A')
               .text(cambiosText, colPositions[4] + 3, rowY + 4, { width: colWidths[4] - 6, lineBreak: false, ellipsis: true });
            
            yPos += rowHeight;
        }
        
        // ============================================================
        // 📌 RESUMEN GENERAL AL FINAL (CENTRALIZADO Y MÁS ESPACIADO)
        // ============================================================
        
        yPos += 15; 

        const accionesOrdenadas = Object.entries(acciones).sort((a, b) => b[1] - a[1]);
        
        // Cambié la división para que sean 3 elementos por fila en lugar de 4
        const filasAcciones = Math.ceil(accionesOrdenadas.length / 3) || 1;
        const altoCajaResumen = 30 + (filasAcciones * 22); // Caja un poco más alta para que respire

        // Verificamos si necesitamos otra página para el resumen
        if (yPos + altoCajaResumen > doc.page.height - 50) {
             doc.addPage();
             yPos = dibujarEncabezado() + 15;
        }

        // Dibujar caja del Resumen General
        doc.rect(50, yPos, pageWidth, altoCajaResumen)
           .fillColor('#f8f5f2').fill()
           .fillColor('#5D4037');
        
        doc.fontSize(9).font('Helvetica-Bold')
           .text('RESUMEN GENERAL', 60, yPos + 10);
        
        let xPos = 70; // Empezamos un poco más hacia el centro (antes 60)
        let yResumen = yPos + 26;
        let contador = 0;
        
        accionesOrdenadas.forEach(([accion, total]) => {
            const color = coloresAcciones[accion] || '#6c757d';
            const nombreCorto = accion.length > 14 ? accion.substring(0, 12) + '..' : accion;
            
            doc.fontSize(7).font('Helvetica')
               .fillColor('#4a3728')
               .text(`${nombreCorto}:`, xPos, yResumen);
            
            doc.rect(xPos + 55, yResumen - 1, 20, 13) // Moví el cuadrito un poco más a la derecha del texto
               .fillColor(color).fill()
               .fillColor('white')
               .fontSize(6)
               .text(total.toString(), xPos + 57, yResumen + 1, { width: 16, align: 'center' });
            
            xPos += 135; // Mucho más espacio entre columnas (antes era 85)
            contador++;
            
            // Cada 3 elementos hacemos salto de línea
            if (contador % 3 === 0) {
                xPos = 70;
                yResumen += 22; // Salto de línea más grande
            }
        });

        // Fin del documento
        doc.end();
        
    } catch (err) {
        console.error('Error exportando auditoría a PDF:', err);
        res.status(500).send('Error al exportar auditoría a PDF');
    }
};
// ==========================
// 📌 EXPORTAR USUARIOS A EXCEL (CORREGIDO - SIN ID, SIN ASIGNACIONES)
// ==========================
exports.exportarUsuariosExcel = async (req, res) => {
    try {
        const usuario = req.session.usuario;
        const { rol, estado, search } = req.query;
        
        let query = `
            SELECT u.id, u.cedula, u.nombre, u.email, u.telefono, 
                   u.estado, u.activo,
                   r.nombre as rol_nombre,
                   c.nombre as calle_nombre
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
            LEFT JOIN calles c ON u.calle_id = c.id
            WHERE 1=1
        `;
        let params = [];
        
        // Filtros por rol (solo UBCH y SuperAdmin pueden ver)
        if (usuario) {
            if (usuario.rol_id === 1) {
                query += " AND u.rol_id != 5";
            }
        }
        
        if (rol && rol !== 'todos' && rol !== '0') {
            query += " AND u.rol_id = ?";
            params.push(rol);
        }
        if (estado && estado !== 'todos') {
            query += " AND u.estado = ?";
            params.push(estado);
        }
        if (search && search !== '') {
            query += " AND (u.nombre LIKE ? OR u.email LIKE ? OR u.cedula LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        query += " ORDER BY u.nombre ASC";
        
        const [usuarios] = await db.query(query, params);
        
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ComuniSolve';
        workbook.created = new Date();
        
        const worksheet = workbook.addWorksheet('Usuarios');
        
        // Estilos de cabecera
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FD6704BD' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
        
        worksheet.columns = [
            { header: 'Cédula', key: 'cedula', width: 15 },
            { header: 'Nombre', key: 'nombre', width: 30 },
            { header: 'Email', key: 'email', width: 35 },
            { header: 'Teléfono', key: 'telefono', width: 15 },
            { header: 'Rol', key: 'rol_nombre', width: 15 },
            { header: 'Calle', key: 'calle_nombre', width: 25 },
            { header: 'Estado', key: 'estado', width: 12 }
        ];
        
        worksheet.getRow(1).eachCell((cell) => {
            Object.assign(cell, headerStyle);
        });
        
        usuarios.forEach((u, index) => {
            const row = worksheet.addRow({
                cedula: u.cedula || '—',
                nombre: u.nombre,
                email: u.email,
                telefono: u.telefono || '—',
                rol_nombre: u.rol_nombre,
                calle_nombre: u.calle_nombre || '—',
                estado: u.estado === 'aprobado' ? 'Aprobado' : u.estado === 'pendiente' ? 'Pendiente' : 'Rechazado'
            });
            
            if (index % 2 === 1) {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0EB' } };
                });
            }
        });
        
        // Hoja de resumen
        const summarySheet = workbook.addWorksheet('Resumen');
        const titleRow = summarySheet.addRow(['COMUNISOLVE - REPORTE DE USUARIOS']);
        titleRow.font = { bold: true, size: 16 };
        summarySheet.addRow([]);
        summarySheet.addRow([`Fecha de exportación: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]);
        summarySheet.addRow([]);
        
        summarySheet.addRow(['RESUMEN POR ROL:']);
        summarySheet.addRow(['Rol', 'Cantidad']);
        const roles = {};
        usuarios.forEach(u => {
            roles[u.rol_nombre] = (roles[u.rol_nombre] || 0) + 1;
        });
        Object.entries(roles).forEach(([rol, total]) => {
            summarySheet.addRow([rol, total]);
        });
        summarySheet.addRow(['Total', usuarios.length]);
        summarySheet.addRow([]);
        
        summarySheet.addRow(['RESUMEN POR ESTADO:']);
        summarySheet.addRow(['Estado', 'Cantidad']);
        const estados = {};
        usuarios.forEach(u => {
            estados[u.estado] = (estados[u.estado] || 0) + 1;
        });
        Object.entries(estados).forEach(([estado, total]) => {
            const nombreEstado = estado === 'aprobado' ? 'Aprobados' : estado === 'pendiente' ? 'Pendientes' : 'Rechazados';
            summarySheet.addRow([nombreEstado, total]);
        });
        
        summarySheet.getColumn(1).width = 30;
        summarySheet.getColumn(2).width = 20;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=usuarios_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('Error exportando usuarios a Excel:', err);
        res.status(500).send('Error al exportar usuarios a Excel');
    }
};

// ==========================
// 📌 EXPORTAR USUARIOS A PDF (OPTIMIZADO - ANCHOS AJUSTADOS)
// ==========================
exports.exportarUsuariosPDF = async (req, res) => {
    try {
        const usuario = req.session.usuario;
        const { rol, estado, search } = req.query;
        
        let query = `
            SELECT u.id, u.cedula, u.nombre, u.email, u.telefono, 
                   u.estado, u.activo,
                   r.nombre as rol_nombre,
                   c.nombre as calle_nombre
            FROM usuarios u
            INNER JOIN roles r ON u.rol_id = r.id
            LEFT JOIN calles c ON u.calle_id = c.id
            WHERE 1=1
        `;
        let params = [];
        
        if (usuario && usuario.rol_id === 1) {
            query += " AND u.rol_id != 5";
        }
        
        if (rol && rol !== 'todos' && rol !== '0') {
            query += " AND u.rol_id = ?";
            params.push(rol);
        }
        if (estado && estado !== 'todos') {
            query += " AND u.estado = ?";
            params.push(estado);
        }
        if (search && search !== '') {
            query += " AND (u.nombre LIKE ? OR u.email LIKE ? OR u.cedula LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        query += " ORDER BY u.nombre ASC";
        
        const [usuarios] = await db.query(query, params);
        
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4',
            autoFirstPage: true,
            bufferPages: true
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=usuarios_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        
        doc.pipe(res);
        
        const pageWidth = doc.page.width - 100;
        
        function dibujarEncabezado() {
            const y = 30;
            doc.rect(50, y, pageWidth, 3).fillColor('#5D4037').fill();
            
            doc.fontSize(18).font('Helvetica-Bold').fillColor('#5D4037')
               .text('ComuniSolve', 50, y + 12, { align: 'center' });
            doc.fontSize(10).font('Helvetica').fillColor('#6c757d')
               .text('Reporte de Usuarios', { align: 'center' });
            doc.fontSize(8).font('Helvetica').fillColor('#8B6B5A')
               .text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, { align: 'center' });
            
            doc.rect(50, doc.y + 2, pageWidth, 1).fillColor('#e0d5c8').fill();
            return doc.y + 8;
        }
        
        let yPos = dibujarEncabezado();
        yPos += 5;
        
        // Filtros
        let filtrosInfo = [];
        if (rol && rol !== 'todos' && rol !== '0') {
            const [rolData] = await db.query('SELECT nombre FROM roles WHERE id = ?', [rol]);
            if (rolData.length > 0) filtrosInfo.push(`Rol: ${rolData[0].nombre}`);
        }
        if (estado && estado !== 'todos') filtrosInfo.push(`Estado: ${estado}`);
        if (search) filtrosInfo.push(`Búsqueda: "${search}"`);
        
        if (filtrosInfo.length > 0) {
            doc.fontSize(7).font('Helvetica').fillColor('#8B6B5A')
               .text(`Filtros: ${filtrosInfo.join(' | ')}`, { align: 'center' });
            yPos = doc.y + 15;
        } else {
            yPos += 10;
        }
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#5D4037')
           .text(`Lista de Usuarios (Total: ${usuarios.length})`, 50, yPos, { underline: true });
        yPos = doc.y + 8;
        
        // ============================================================
        // 📌 ANCHOS OPTIMIZADOS
        // Cédula: 55 | Nombre: 75 | Email: 110 | Rol: 60 | Estado: 45
        // ============================================================
        const colWidths = [55, 75, 110, 60, 45];
        const colPositions = [50];
        for (let i = 1; i < colWidths.length; i++) {
            colPositions.push(colPositions[i-1] + colWidths[i-1]);
        }
        const rowHeight = 18; // Reducido de 20 a 18 para que quepan más filas
        let itemCount = 0;
        
        function dibujarCabeceras() {
            doc.rect(50, yPos, pageWidth, rowHeight)
               .fillColor('#5D4037').fill()
               .fillColor('white');
            
            const headers = ['Cédula', 'Nombre', 'Email', 'Rol', 'Estado'];
            doc.fontSize(7).font('Helvetica-Bold');
            colPositions.forEach((x, i) => {
                doc.text(headers[i], x + 3, yPos + 5, { width: colWidths[i] - 6, align: 'center' });
            });
            yPos += rowHeight;
        }
        
        dibujarCabeceras();
        
        const estadoColors = {
            'aprobado': '#28a745',
            'pendiente': '#ffc107',
            'rechazado': '#dc3545'
        };
        
        for (const u of usuarios) {
            itemCount++;
            const fillColor = itemCount % 2 === 0 ? '#faf8f6' : '#ffffff';
            
            if (yPos + rowHeight > doc.page.height - 60) {
                doc.addPage();
                yPos = dibujarEncabezado() + 8;
                dibujarCabeceras();
            }
            
            doc.rect(50, yPos, pageWidth, rowHeight)
               .fillColor(fillColor).fill()
               .fillColor('#4a3728');
            
            doc.fontSize(6.5).font('Helvetica')
               .text(u.cedula || '—', colPositions[0] + 3, yPos + 4, { width: colWidths[0] - 6, align: 'center' });
            
            doc.text(u.nombre, colPositions[1] + 3, yPos + 4, { width: colWidths[1] - 6, align: 'center', ellipsis: true });
            
            doc.text(u.email, colPositions[2] + 3, yPos + 4, { width: colWidths[2] - 6, align: 'center', ellipsis: true });
            
            doc.text(u.rol_nombre, colPositions[3] + 3, yPos + 4, { width: colWidths[3] - 6, align: 'center' });
            
            // Estado - con badge más compacto
            const color = estadoColors[u.estado] || '#6c757d';
            const estadoTexto = u.estado === 'aprobado' ? 'Aprobado' : u.estado === 'pendiente' ? 'Pendiente' : 'Rechazado';
            const badgeWidth = 38;
            const badgeX = colPositions[4] + (colWidths[4] - badgeWidth) / 2;
            
            doc.rect(badgeX, yPos + 2, badgeWidth, 14)
               .fillColor(color).fill()
               .fillColor('white')
               .fontSize(5.5).font('Helvetica-Bold')
               .text(estadoTexto, badgeX, yPos + 4.5, { width: badgeWidth, align: 'center' });
            
            yPos += rowHeight;
        }
        
        doc.end();
        
    } catch (err) {
        console.error('Error exportando usuarios a PDF:', err);
        res.status(500).send('Error al exportar usuarios a PDF');
    }
};