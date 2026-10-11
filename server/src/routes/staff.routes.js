const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const Campana = require('../models/Campana');
const Agente = require('../models/Agente');

// --- STAFF SYNC (REAL DATA FROM EXCEL) ---
router.post('/staff/sync', async (req, res) => {
    try {
        const { fileBase64, fileName } = req.body;

        if (!fileBase64) return res.status(400).json({ error: 'No se envió ningún archivo' });

        const base64Data = fileBase64.replace(/^data:.*,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        let movilCount = 0;
        let retencionCount = 0;
        let retencionNocturno = 0;
        let movilNocturno = 0;

        const poolsList = await Campana.findAll();
        const possibleColumns = ['turno', 'horario', 'entrada', 'salida', 'jornada', 'shift', 'schedule', 'time'];

        for (const row of data) {
            const rowValues = Object.values(row).map(v => (v || '').toString().toLowerCase());
            const rowStr = rowValues.join(' ');
            const isMovil = rowStr.includes('movil') || rowStr.includes('móvil');

            let isNocturno = false;
            let scheduledTime = '09:00';
            let shiftName = 'Matutino';
            let timeFound = false;

            // PRIMERO: Buscar hora explícita en las columnas (ej. Horario 2)
            for (const key of Object.keys(row)) {
                const val = (row[key] || '').toString().toLowerCase();
                const keyLow = key.toLowerCase();
                if (possibleColumns.some(pc => keyLow.includes(pc))) {
                    const timeMatch = val.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]/);
                    if (timeMatch) {
                        scheduledTime = timeMatch[0];
                        const startHour = parseInt(timeMatch[0].split(':')[0]);
                        if (startHour >= 22 || startHour <= 2) {
                            isNocturno = true;
                            shiftName = 'Nocturno';
                        } else if (startHour >= 11) {
                            shiftName = 'Vespertino';
                        }
                        timeFound = true;
                        break;
                    }
                }
            }

            // SEGUNDO: Si no encontró hora explícita, usar la palabra Turno como respaldo
            if (!timeFound) {
                const turnoDirecto = (row['Turno'] || row['turno'] || row['TURNO'] || '').toString().trim();
                if (turnoDirecto) {
                    const turnoLow = turnoDirecto.toLowerCase();
                    if (turnoLow.includes('nocturno') || turnoLow.includes('noche')) {
                        isNocturno = true;
                        shiftName = 'Nocturno';
                        scheduledTime = '23:00';
                    } else if (turnoLow.includes('vespertino') || turnoLow.includes('tarde')) {
                        shiftName = 'Vespertino';
                        scheduledTime = '11:00';
                    } else {
                        shiftName = 'Matutino';
                        scheduledTime = '09:00';
                    }
                }
            }

            const nameColumn = Object.keys(row).find(key =>
                ['nombre', 'agente', 'colaborador', 'staff', 'name'].some(n => key.toLowerCase().includes(n))
            ) || Object.keys(row)[0];

            const supervisorColumn = Object.keys(row).find(key =>
                ['supervisor', 'lider', 'coordinador', 'leader'].some(s => key.toLowerCase().includes(s))
            );

            const agentName = row[nameColumn] ? row[nameColumn].toString().trim() : 'Agente Desconocido';
            const supervisorName = supervisorColumn ? row[supervisorColumn].toString().trim() : 'Sin Asignar';
            
            const normalizeStr = (s) => (s || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            const targetPool = poolsList.find(p => {
                const pName = normalizeStr(p.nombre);
                return isMovil ? pName.includes('movil') : pName.includes('retencion');
            });

            await Agente.upsert({
                nombre: agentName,
                campanaId: targetPool ? targetPool.id : null,
                horaEntradaProgramada: scheduledTime,
                numero_agente: row['Nómina'] || row['Nomina'] || row['ID'] || row['numero_agente'],
                turno: shiftName,
                supervisor: supervisorName
            });

            if (isMovil) {
                movilCount++;
                if (isNocturno) movilNocturno++;
            } else {
                retencionCount++;
                if (isNocturno) retencionNocturno++;
            }
        }

        for (const pool of poolsList) {
            if (pool.nombre.toLowerCase().includes('retencion') || pool.nombre.toLowerCase().includes('retención')) {
                pool.totalAgentes = retencionCount;
                pool.agentesNocturnos = retencionNocturno;
            } else if (pool.nombre.toLowerCase().includes('movil') || pool.nombre.toLowerCase().includes('móvil')) {
                pool.totalAgentes = movilCount;
                pool.agentesNocturnos = movilNocturno;
            }
            await pool.save();
        }

        res.json({ success: true, retencionCount, movilCount, retencionNocturno, movilNocturno });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
