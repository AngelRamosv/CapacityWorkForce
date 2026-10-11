const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const { Op } = require('sequelize');
const sequelize = require('../database');
const Asistencia = require('../models/Asistencia');
const { syncAttendanceFromCentral } = require('../services/attendanceSync');

// --- REPORTES / ASISTENCIA ---
router.get('/reports/attendance', async (req, res) => {
    try {
        const { startDate, endDate, poolId, turno } = req.query;
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const targetDate = startDate || today;

        // Ahora TODOS los botones pueden sincronizar (siempre filtrado por turno)
        await syncAttendanceFromCentral(targetDate, turno || 'todos');

        const where = {};
        if (startDate && endDate) {
            where.fecha = { [Op.between]: [startDate, endDate] };
        } else {
            where.fecha = today;
        }
        if (poolId) where.campanaId = poolId;

        // Filtrar por turno para la visualización
        if (turno === 'matutino') {
            where.horaEntradaProgramada = '09:00';
        } else if (turno === 'intermedio') {
            where.horaEntradaProgramada = '10:00';
        } else if (turno === 'vespertino') {
            where.horaEntradaProgramada = '11:00';
        } else if (turno === 'ausentes') {
            where.estatusAsistencia = { [Op.in]: ['Ausente', 'Por Ingresar'] };
        }

        const attendance = await Asistencia.findAll({
            where,
            order: [
                ['fecha', 'DESC'],
                [sequelize.literal("CASE WHEN estatusAsistencia = 'Ausente' THEN 1 WHEN estatusAsistencia = 'Por Ingresar' THEN 2 ELSE 0 END"), 'ASC'],
                ['horaEntradaReal', 'ASC']
            ]
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/reports/attendance/export', async (req, res) => {
    try {
        const { startDate, endDate, poolId, turno } = req.query;
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const targetDate = startDate || today;

        // Asegurar que los datos del Excel estén actualizados antes de exportar
        await syncAttendanceFromCentral(targetDate, turno || 'todos');

        const where = {};
        if (startDate && endDate) {
            where.fecha = { [Op.between]: [startDate, endDate] };
        }
        if (poolId) where.campanaId = poolId;

        // Filtrar por turno para el Excel
        if (turno === 'matutino') {
            where.horaEntradaProgramada = '09:00';
        } else if (turno === 'intermedio') {
            where.horaEntradaProgramada = '10:00';
        } else if (turno === 'vespertino') {
            where.horaEntradaProgramada = '11:00';
        } else if (turno === 'ausentes') {
            where.estatusAsistencia = { [Op.in]: ['Ausente', 'Por Ingresar'] };
        }

        const attendance = await Asistencia.findAll({
            where,
            order: [
                ['fecha', 'ASC'],
                [sequelize.literal("CASE WHEN estatusAsistencia = 'Ausente' THEN 1 WHEN estatusAsistencia = 'Por Ingresar' THEN 2 ELSE 0 END"), 'ASC'],
                ['horaEntradaReal', 'ASC']
            ]
        });

        const data = attendance.map(a => ({
            'Fecha': a.fecha.split('-').reverse().join('/'),
            'Agente': a.nombreAgente,
            'Entrada Programada': a.horaEntradaProgramada,
            'Entrada Real': a.horaEntradaReal,
            'Tiempo Logueado': a.tiempoLogueado || '-',
            'Minutos Retardo': a.minutosRetardo,
            'Impacto (Llamadas)': a.impactoLlamadas > 0 ? `-${a.impactoLlamadas}` : '0',
            'Estatus': a.estatusAsistencia
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, "Asistencia");
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_Asistencia.xlsx`);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/reports/attendance', async (req, res) => {
    try {
        const { startDate, endDate, poolId } = req.query;
        const where = { fecha: { [Op.between]: [startDate, endDate] } };
        if (poolId) where.campanaId = poolId;
        await Asistencia.destroy({ where });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
