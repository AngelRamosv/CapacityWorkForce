const express = require('express');
const router = express.Router();
const Campana = require('../models/Campana');
const Configuracion = require('../models/Configuracion');
const PlanSemanal = require('../models/PlanSemanal');
const BitacoraCambio = require('../models/BitacoraCambio');
const Vacacion = require('../models/Vacacion');
const MetricaOperativa = require('../models/MetricaOperativa');
const Asistencia = require('../models/Asistencia');
const Agente = require('../models/Agente');
const WfmService = require('../services/WfmService');
const axios = require('axios');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { Op } = require('sequelize');
const sequelize = require('../database');

// --- CAMPAÑAS & CONFIGURACIÓN ---
router.get('/pools', async (req, res) => {
    const campanas = await Campana.findAll();
    res.json(campanas);
});

router.put('/pools/:id', async (req, res) => {
    try {
        const { totalAgentes, agentesNocturnos } = req.body;
        const campana = await Campana.findByPk(req.params.id);
        if (!campana) return res.status(404).json({ error: 'Campaña no encontrada' });

        if (totalAgentes !== undefined) campana.totalAgentes = totalAgentes;
        if (agentesNocturnos !== undefined) campana.agentesNocturnos = agentesNocturnos;

        await campana.save();
        res.json(campana);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/config', async (req, res) => {
    const config = await Configuracion.findOne();
    res.json(config);
});

router.put('/config', async (req, res) => {
    try {
        const { shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos } = req.body;
        let config = await Configuracion.findOne();
        if (!config) {
            config = await Configuracion.create({ shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos });
        } else {
            await config.update({ shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

// --- VACACIONES ---
router.get('/vacations', async (req, res) => {
    const vacations = await Vacacion.findAll();
    res.json(vacations);
});

router.post('/vacations', async (req, res) => {
    try {
        const vacation = await Vacacion.create(req.body);
        res.json(vacation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/vacations/:id', async (req, res) => {
    await Vacacion.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

// --- LIVE OPERATIONS ---
let lastSyncTimestamp = 0;

router.get('/live', async (req, res) => {
    try {
        let response;
        let centralDown = false;
        try {
            response = await axios.get('http://192.168.48.183:8050/data', { timeout: 10000 });
        } catch (centralError) {
            centralDown = true;
            response = { data: { llamadas_ingresadas: 0, abandonadas_total: 0, porcentaje_abandono: 0, media_total: '0' } };
        }

        let realData = response.data;
        if (typeof realData === 'string') {
            try {
                // Sanitizar NaN inválido en el JSON del marcador central
                const sanitized = realData.replace(/:\s*NaN\b/g, ': null');
                realData = JSON.parse(sanitized);
            } catch (e) {
                console.error("Failed to parse sanitized central JSON:", e.message);
                realData = { llamadas_ingresadas: 0, abandonadas_total: 0, porcentaje_abandono: 0, media_total: '0' };
            }
        }

        // --- MODO DE CONTINGENCIA INTELIGENTE (CENTRAL TRABADA O INCOMPLETA) ---
        // Si el contador de llamadas de la central está en 843 (congelado) o si la central está caída:
        if (realData.llamadas_ingresadas === 843 || centralDown) {
            // Caso A: Si la central reporta contestadas_total reales acumuladas (mayor a 0),
            // lo que suele ocurrir cuando el marcador apaga la cola o se va a 0 llamadas_ingresadas pero
            // mantiene los acumulados históricos de contestadas y abandonadas del día.
            if (realData.contestadas_total && realData.contestadas_total > 0) {
                realData.llamadas_ingresadas = realData.contestadas_total + (realData.abandonadas_total || 0);
            } else {
                // Caso B: Si todo está en cero o realmente trabado sin acumulados en la central,
                // vamos a la base de datos (reporteProductividad).
                const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
                let dbAnswered = 0;
                
                try {
                    const prodConn = await mysql.createConnection({
                        host: '192.168.50.33',
                        user: 'cyberhub',
                        password: 'masterC1berHUb#',
                        database: 'cyber_ideas_hub'
                    });
                    const [rows] = await prodConn.execute(
                        "SELECT SUM(llamadas_entrantes) AS total_contestadas FROM reporteProductividad WHERE DATE(CONVERT_TZ(FechaCaptura, SUBSTRING(TIMEDIFF(NOW(), UTC_TIMESTAMP()), 1, 6), '-06:00')) = ?",
                        [today]
                    );
                    if (rows && rows[0] && rows[0].total_contestadas !== null) {
                        dbAnswered = parseInt(rows[0].total_contestadas) || 0;
                    }
                    await prodConn.end();
                } catch (dbErr) {
                    console.error('Error fetching live calls from remote DB:', dbErr.message);
                }

                let calculatedAnswered = dbAnswered;
                if (calculatedAnswered <= 0) {
                    const totalAgentMinutes = (realData.valores || []).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
                    calculatedAnswered = Math.round(totalAgentMinutes * 0.083);
                }
                
                const calculatedAbandoned = Math.round(calculatedAnswered * 0.035); // ~3.5% abandono promedio
                
                realData.contestadas_total = calculatedAnswered;
                realData.abandonadas_total = calculatedAbandoned;
                realData.llamadas_ingresadas = calculatedAnswered + calculatedAbandoned;
                realData.porcentaje_abandono = 3;
                realData.media_total = 8.5;
            }
        }

        const config = await Configuracion.findOne();
        const offsetCalls = config?.ajusteLlamadas || 0;
        const offsetAbandoned = config?.ajusteAbandonadas || 0;

        if (realData.llamadas_ingresadas !== undefined) {
            realData.llamadas_ingresadas = Math.max(0, realData.llamadas_ingresadas - offsetCalls);
        }
        if (realData.abandonadas_total !== undefined) {
            realData.abandonadas_total = Math.max(0, realData.abandonadas_total - offsetAbandoned);
        }

        // --- AUTO-SYNC DE ASISTENCIA (cada 2 min) ---
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const now = Date.now();
        if (now - lastSyncTimestamp > 120000) { 
            lastSyncTimestamp = now;
            syncAttendanceFromCentral(today, 'todos').catch(err => console.error('Auto-Sync Error:', err.message));
        }

        const agents = await Agente.findAll();
        const agentsMapById = new Map();
        const agentsMapByName = new Map();
        const agentsInfoMap = new Map();
        
        agents.forEach(a => {
            const cleanId = (a.numero_agente || '').replace(/\D/g, '');
            if (cleanId) {
                agentsMapById.set(cleanId, a.supervisor);
                agentsInfoMap.set(cleanId, a.turno);
            }
            const norm = (a.nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            agentsMapByName.set(norm, a.supervisor);
        });

        const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const hNow = nowMx.getHours();

        if (realData.nombres && realData.nombres.length > 0) {
            // --- FILTRO DE FANTASMAS Y RE-MAPEADO DE SUPERVISORES ---
            const filteredIndices = [];
            realData.nombres.forEach((n, idx) => {
                const idPart = n.split(' - ')[0] || '';
                const cleanId = idPart.replace(/\D/g, '');
                const turno = agentsInfoMap.get(cleanId);
                const valor = realData.valores ? realData.valores[idx] : 0;

                // Si es mañana y tenemos un nocturno con tiempo estancado, lo filtramos
                if (hNow >= 8 && hNow <= 11 && turno === 'Nocturno' && valor < 20) {
                    return;
                }
                filteredIndices.push(idx);
            });

            if (filteredIndices.length < realData.nombres.length) {
                realData.nombres = filteredIndices.map(i => realData.nombres[i]);
                if (realData.supervisores) realData.supervisores = filteredIndices.map(i => realData.supervisores[i]);
                if (realData.valores) realData.valores = filteredIndices.map(i => realData.valores[i]);
                if (realData.auxiliares_actuales) realData.auxiliares_actuales = filteredIndices.map(i => realData.auxiliares_actuales[i]);
                realData.total_agentes = realData.nombres.length;
            }

            // Asegurar supervisores correctos
            realData.supervisores = realData.nombres.map((n, i) => {
                const idPart = n.split(' - ')[0] || '';
                const cleanId = idPart.replace(/\D/g, '');
                const dbSup = agentsMapById.get(cleanId);
                
                // Si la DB local tiene un supervisor asignado real, lo usamos. 
                // De lo contrario, confiamos en lo que diga la central.
                if (dbSup && dbSup !== 'Sin Asignar') {
                    return dbSup;
                }
                return realData.supervisores[i] || 'Sin Asignar';
            });

            if (realData.valores && realData.nombres) {
                realData.tiempos_en_estado = realData.valores.map(v => `${Math.floor(v)}m`);
            }
        }

        // --- PUNTUALIDAD ---
        const currentTimeStr = `${nowMx.getHours().toString().padStart(2, '0')}:${nowMx.getMinutes().toString().padStart(2, '0')}`;
        const todayAttendance = await Asistencia.findAll({ 
            where: { 
                fecha: today,
                horaEntradaReal: { [Op.and]: [{ [Op.lte]: currentTimeStr }, { [Op.gte]: '06:00' }] }
            } 
        });
        const allRetardos = todayAttendance.filter(a => a.minutosRetardo > 0);
        realData.puntualidad = {
            totalLoginDelay: allRetardos.reduce((sum, a) => sum + (a.minutosRetardo || 0), 0),
            tardyEntrants: allRetardos.map(a => ({ name: a.nombreAgente, delay: a.minutosRetardo }))
        };

        // --- HISTÓRICO VOLUMEN ---
        const fs = require('fs');
        const path = require('path');
        const hFile = path.join(__dirname, '../data/historicalVolume.json');
        let histData = {};
        try { if (fs.existsSync(hFile)) histData = JSON.parse(fs.readFileSync(hFile)); } catch (e) { }
        const cHour = hNow.toString();
        if (!histData[today]) histData[today] = {};
        const currentIn = parseFloat(realData.llamadas_ingresadas || 0);
        if (currentIn > 0 && (!histData[today][cHour] || currentIn > histData[today][cHour])) {
            histData[today][cHour] = currentIn;
            try {
                if (!fs.existsSync(path.join(__dirname, '../data'))) fs.mkdirSync(path.join(__dirname, '../data'));
                fs.writeFileSync(hFile, JSON.stringify(histData));
            } catch (e) { }
        }

        res.json(realData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/live/reset', async (req, res) => {
    try {
        const response = await axios.get('http://192.168.48.183:8050/data', { timeout: 10000 });
        const currentTotal = response.data.llamadas_ingresadas || 0;
        const currentAbandoned = response.data.abandonadas_total || 0;

        let config = await Configuracion.findOne();
        if (config) {
            await config.update({ ajusteLlamadas: currentTotal, ajusteAbandonadas: currentAbandoned });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint Inteligente para cálculo de Cobertura Intradía
router.get('/live/coverage', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const dateInMexico = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const dayOfWeek = dateInMexico.getDay(); 
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        
        // Obtener la semana actual para buscar el plan
        const currentYear = dateInMexico.getFullYear();
        const getWeekNumber = (d) => {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
            var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
            return weekNo;
        };
        const currentWeek = getWeekNumber(dateInMexico);

        // Buscar el plan más reciente para esta semana
        const latestPlan = await PlanSemanal.findOne({
            where: { numeroSemana: currentWeek, anio: currentYear },
            order: [['createdAt', 'DESC']]
        });

        const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const todayName = dayNames[dayOfWeek];

        let baseTotal = 3195;
        if (dayOfWeek === 6) baseTotal = 1500;
        else if (dayOfWeek === 0) baseTotal = 780;

        // Si existe un plan guardado, usar la meta planeada para hoy
        if (latestPlan && latestPlan.distribucion && latestPlan.distribucion[todayName]) {
            baseTotal = latestPlan.distribucion[todayName].planned || baseTotal;
        }

        let histData = {};
        try {
            const hFile = path.join(__dirname, '../data/historicalVolume.json');
            if (fs.existsSync(hFile)) {
                histData = JSON.parse(fs.readFileSync(hFile));
            }
        } catch(e) {}

        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        
        // FIJAR META ESTRICTAMENTE (Static Forecast)
        const staticDailyVolume = baseTotal; 
        const nightVolumeExpected = staticDailyVolume * 0.25; 

        let todayHist = histData[todayStr] || null;

        const hourlyData = [];
        const baseCurve = [0.06, 0.08, 0.09, 0.09, 0.08, 0.07, 0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.05, 0.04, 0.04];
        const currentHour = dateInMexico.getHours();

        for (let i = 0; i < 15; i++) {
            const h = 9 + i;
            let expectedForHour = Math.round(staticDailyVolume * baseCurve[i]);
            let realCallsForHour = null;

            if (todayHist && h <= currentHour) {
                let walkBack = h - 1;
                while(walkBack >= 1 && todayHist[walkBack.toString()] === undefined) walkBack--;
                
                let valPrev = 0;
                if (walkBack >= 1 && todayHist[walkBack.toString()] !== undefined) {
                    valPrev = todayHist[walkBack.toString()];
                }

                let valNow = todayHist[h.toString()];
                
                if (valNow !== undefined) {
                    realCallsForHour = valNow - valPrev;
                    if (realCallsForHour < 0) {
                        // Si la caída es masiva (ej. de miles a menos de la mitad), es un reinicio real del marcador
                        // Si es una fluctuación menor (ej. de 3226 a 3205), es una corrección menor y se toma como 0
                        if (valNow < valPrev * 0.5) {
                            realCallsForHour = valNow;
                        } else {
                            realCallsForHour = 0;
                        }
                    }
                }
            }

            hourlyData.push({
                hour: `${h}:00 ${h < 12 ? 'am' : 'pm'}`,
                expected: expectedForHour,
                realCalls: realCallsForHour,
                isNight: h >= 18
            });
        }

        let ahtReferencia = 11.5; 
        try {
            const ConfigData = require('../models/Configuracion');
            const conf = await ConfigData.findOne();
            if (conf && conf.tmoMinutos) ahtReferencia = conf.tmoMinutos;
        } catch(e) {}

        const minutosRequeridos = nightVolumeExpected * ahtReferencia;
        const ocupacionEsperada = 0.85; 
        let agentesNecesariosTurno = Math.ceil((minutosRequeridos / 60) / 5 / ocupacionEsperada); 

        if (isWeekend) agentesNecesariosTurno = Math.floor(agentesNecesariosTurno * 0.5);

        const AgenteModel = require('../models/Agente');
        const todos = await AgenteModel.findAll();
        
        let assignedNight = todos.filter(a => {
            const h = a.horaEntradaProgramada || '09:00';
            const hNum = parseInt(h.split(':')[0]);
            return hNum >= 10; 
        });

        let deficit = agentesNecesariosTurno - assignedNight.length;
        if(deficit < 0 && agentesNecesariosTurno < 0) deficit = 0;
        
        let suggestion = "Cobertura adecuada. No se requieren traslados de turnos.";
        let state = 'verde';

        if (isWeekend) {
            suggestion = `✅ Operación de Fin de Semana. La regla de reacomodo estricto está apagada. Meta de hoy: ${baseTotal} llamadas.`;
            state = 'verde';
        } else {
            if (deficit > 0) {
                suggestion = `⚠️ Se espera alta demanda a partir de las 18:00 hrs. Faltan ${deficit} agentes. Recomendación: Mueve a ${deficit} agentes del turno 09:00 al turno Vespertino/Intermedio para evitar sobrecarga.`;
                state = 'rojo';
            } else if (deficit <= 0) {
                suggestion = `💡 Capacidad Nocturna Satisfactoria (Sobran ${Math.abs(deficit)} agentes). La cobertura de 6 PM a 11 PM está asegurada.`;
                state = 'verde';
            }
        }

        // Generar requerimientos detallados por hora para las barras de reacomodo (SOLO 6 PM EN ADELANTE)
        const nightHourlyRequirements = hourlyData.filter(item => {
            const hNum = parseInt(item.hour.split(':')[0]);
            // Si es PM y >= 6 (pero manejamos formato 24h en hNum)
            return hNum >= 18;
        }).map(item => {
            const hNum = parseInt(item.hour.split(':')[0]);
            // Cálculo simple de requerimiento basado en la curva y TMO
            const reqAgts = Math.ceil((item.expected * ahtReferencia / 60) / 1 / ocupacionEsperada);
            const schAgts = todos.filter(a => {
                const entryH = parseInt((a.horaEntradaProgramada || '09:00').split(':')[0]);
                const exitH = entryH + 9;
                return hNum >= entryH && hNum < exitH;
            }).length;

            return {
                ...item,
                requiredAgents: reqAgts,
                scheduledAgents: schAgts
            };
        });

        res.json({
            required: agentesNecesariosTurno,
            actualScheduled: assignedNight.length,
            deficit: deficit,
            expectedCalls: Math.round(nightVolumeExpected),
            suggestion: suggestion,
            status: state,
            isWeekend: isWeekend,
            hourlyData: hourlyData,
            nightHourlyRequirements: nightHourlyRequirements,
            dailyGoal: baseTotal,
            averageExpectedPerHour: Math.round(baseTotal / 15)
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PLANES ---
router.get('/plans/:poolId', async (req, res) => {
    const plans = await PlanSemanal.findAll({
        where: { campanaId: req.params.poolId },
        order: [['anio', 'DESC'], ['numeroSemana', 'DESC']]
    });
    res.json(plans);
});

router.post('/simulate', async (req, res) => {
    const { totalAgents, distribution, agentesNocturnos } = req.body;
    const effectiveTotal = (totalAgents || 0) - (agentesNocturnos || 0);
    const balance = WfmService.calculateZeroSumBalance(effectiveTotal, distribution);
    res.json(balance);
});

router.post('/plans', async (req, res) => {
    try {
        const { poolId, weekNumber, year, distribution } = req.body;
        const pool = await Campana.findByPk(poolId);
        if (!pool) return res.status(404).json({ error: 'Campaña no encontrada' });

        const effectiveTotalAgents = (pool.totalAgentes || 0) - (pool.agentesNocturnos || 0);
        const balance = WfmService.calculateZeroSumBalance(effectiveTotalAgents, distribution);

        // Siempre crear un nuevo plan para mantener el histórico de versiones
        const plan = await PlanSemanal.create({ 
            campanaId: poolId, 
            numeroSemana: weekNumber, 
            anio: year, 
            distribucion: distribution 
        });
        
        res.json({ plan, balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/plans/:id', async (req, res) => {
    await PlanSemanal.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

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

// Función Maestra de Sincronización
// turno: 'todos', 'matutino', 'vespertino', 'ausentes'
async function syncAttendanceFromCentral(targetDate, turno = 'todos') {
    try {
        // REGLA: No tocamos agentes nocturnos
        let allAgents = await Agente.findAll({
            where: { turno: { [Op.in]: ['Matutino', 'Vespertino'] } }
        });

        // Filtrar agentes por turno seleccionado 
        if (turno === 'matutino') {
            allAgents = allAgents.filter(a => a.horaEntradaProgramada === '09:00');
        } else if (turno === 'intermedio') {
            allAgents = allAgents.filter(a => a.horaEntradaProgramada === '10:00');
        } else if (turno === 'vespertino') {
            allAgents = allAgents.filter(a => a.horaEntradaProgramada === '11:00');
        }
        // 'ausentes' y '' procesan todos los agentes
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        let productivityData = [];
        try {
            const prodConn = await mysql.createConnection({
                host: '192.168.50.33',
                user: 'cyberhub',
                password: 'masterC1berHUb#',
                database: 'cyber_ideas_hub'
            });
            const [rows] = await prodConn.execute(
                'SELECT numero_agente, nombre_agente, tiempo_logueado, FechaCaptura FROM reporteProductividad WHERE DATE(FechaCaptura) = ? AND tiempo_logueado > "00:00:00" ORDER BY id DESC',
                [targetDate]
            );
            productivityData = rows;
            await prodConn.end();
        } catch (err) {
            console.error('Remote DB Error:', err.message);
        }

        // Para 'ausentes': aunque no haya datos en CyberHub, procesamos la ausencia
        if (productivityData.length === 0 && turno !== 'ausentes') return;

        const existingEntries = await Asistencia.findAll({ where: { fecha: targetDate } });
        const recordedNames = new Set(existingEntries.map(a => a.nombreAgente));

        // Obtener configuración global (turno horas y tolerancia)
        const config = await Configuracion.findOne();
        const tolerance = config?.toleranciaRetardoMinutos || 5;
        const tmo = config?.tmoMinutos || 11.5;
        const horasTurno = config?.horasTurno || 8;

        // Datos de tiempo actual en México
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const nowMinutes = nowMx.getHours() * 60 + nowMx.getMinutes();

        for (const agent of allAgents) {
            let prodRow = productivityData.find(p => {
                const prodId = String(p.numero_agente).trim();
                const localId = String(agent.numero_agente).replace(/\D/g, ''); // Remueve 'CCI' u otras letras
                return prodId === localId && localId !== '';
            });

            // Para turno 'ausentes': si el agente tiene datos, lo saltamos (ya fue procesado)
            if (turno === 'ausentes' && prodRow) continue;

            // Para turno 'ausentes' sin datos: verificar si el turno ya debería haber empezado
            if (turno === 'ausentes' && !prodRow) {
                const [entH] = (agent.horaEntradaProgramada || '09:00').split(':').map(Number);
                const isToday = targetDate === todayStr;
                if (isToday && nowMinutes < entH * 60) continue; // Turno aún no empieza
            }

            let officialLoginTime = agent.horaEntradaProgramada;
            let delayMinutos = 0;
            let loggedTimeStr = null;

            if (prodRow && prodRow.tiempo_logueado) {
                loggedTimeStr = prodRow.tiempo_logueado;
                const [h, m, s] = prodRow.tiempo_logueado.split(':').map(Number);
                const totalSeconds = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);

                // --- LIMPIEZA DE DATOS SUPREMA ---
                const rawSchedule = (agent.horaEntradaProgramada || '09:00').toString();
                const cleanSchedule = rawSchedule.match(/\d{1,2}:\d{2}/)?.[0] || '09:00';
                const [entH, entM] = cleanSchedule.split(':').map(n => parseInt(n) || 0);
                const scheduledTotalMin = (entH * 60) + entM;

                const isToday = targetDate === todayStr;

                // PROTECCION CRITICA: No procesar si el turno aún no empieza
                // Evita que en la madrugada se tome el 'tiempo_logueado' del día anterior y calcule horas falsas como '14:58'
                if (isToday && nowMinutes < scheduledTotalMin) {
                    // El turno aún no empieza, forzamos ignorar cualquier 'prodRow' basura de ayer
                    prodRow = null;
                    loggedTimeStr = null;
                } else {
                    // Por defecto, asumimos que llegaron a su hora
                    let loginTotalMin = scheduledTotalMin;
                    let loginH = entH;
                    let loginM = entM;

                    // Si lo estamos atrapando "en vivo" el mismo día
                    if (isToday) {
                        // Calculamos la hora de entrada restando el tiempo logueado de la hora actual
                        const loginDate = new Date(Date.now() - totalSeconds * 1000);
                        let calcH = (loginDate instanceof Date && !isNaN(loginDate)) ? loginDate.getHours() : entH;
                        let calcM = (loginDate instanceof Date && !isNaN(loginDate)) ? loginDate.getMinutes() : entM;
                        let calculatedMin = (calcH * 60) + calcM;

                        // Si el cálculo muestra un retardo
                        if (calculatedMin > scheduledTotalMin) {
                            // REGLA DE ORO: 
                            // Solo aceptamos el retardo si la hora actual NO HA PASADO por más de 12 horas de su hora programada.
                            if (nowMinutes <= scheduledTotalMin + 720) {
                                loginTotalMin = calculatedMin;
                                loginH = calcH;
                                loginM = calcM;
                            }
                        } else {
                            // Si llegó temprano, respetamos el cálculo
                            if (scheduledTotalMin - calculatedMin > 120) {
                                prodRow = null;
                                loggedTimeStr = null;
                            } else {
                                loginTotalMin = calculatedMin;
                                loginH = calcH;
                                loginM = calcM;
                            }
                        }
                    }

                    // Formatear hora real final (HH:MM)
                    officialLoginTime = `${String(loginH).padStart(2, '0')}:${String(loginM).padStart(2, '0')}`;

                    // --- PROTECCIÓN CONTRA SOBREESCRITURA ---
                    const existing = existingEntries.find(e => e.nombreAgente === agent.nombre);
                    if (existing && existing.horaEntradaReal !== agent.horaEntradaProgramada && officialLoginTime === agent.horaEntradaProgramada) {
                        officialLoginTime = existing.horaEntradaReal;
                        const [exH, exM] = officialLoginTime.split(':').map(Number);
                        const exTotalMin = exH * 60 + exM;
                        delayMinutos = Math.max(0, exTotalMin - scheduledTotalMin - tolerance);
                    } else {
                        if (loginTotalMin <= scheduledTotalMin + tolerance) {
                            delayMinutos = 0;
                        } else {
                            delayMinutos = loginTotalMin - scheduledTotalMin - tolerance;
                        }
                    }
                }
            }

            const existingEntry = existingEntries.find(e => e.nombreAgente === agent.nombre);
            let estatusAsistencia = delayMinutos > 0 ? 'Retardo' : 'A Tiempo';
            let impacto = delayMinutos === 0 ? 0 : Math.round(delayMinutos / tmo);

            if (!prodRow) {
                // Verificar si el turno del agente ya debería haber comenzado
                const [entH, entM] = (agent.horaEntradaProgramada || '09:00').split(':').map(Number);
                const scheduledMinutes = entH * 60 + entM;
                const currentMinutes = nowMx.getHours() * 60 + nowMx.getMinutes();
                const isToday = targetDate === todayStr;

                if (isToday && currentMinutes < scheduledMinutes) {
                    // El turno aún no ha comenzado → "Por Ingresar" (no es Ausente real)
                    estatusAsistencia = 'Por Ingresar';
                    impacto = 0;
                } else {
                    // El turno ya debería haber comenzado y no hay datos → Ausente real
                    estatusAsistencia = 'Ausente';
                    impacto = 8;
                }
                officialLoginTime = agent.horaEntradaProgramada || '09:00';
                delayMinutos = 0;
            }

            if (existingEntry) {
                const esPendiente = existingEntry.estatusAsistencia === 'Por Ingresar';
                const esAusenteRescatable = existingEntry.estatusAsistencia === 'Ausente' && loggedTimeStr;

                if (esPendiente || esAusenteRescatable) {
                    // Rescatar: el agente ya tiene datos en CyberHub → actualizar todo el registro
                    await existingEntry.update({
                        horaEntradaProgramada: agent.horaEntradaProgramada,
                        horaEntradaReal: officialLoginTime,
                        minutosRetardo: delayMinutos,
                        impactoLlamadas: impacto,
                        estatusAsistencia: estatusAsistencia,
                        tiempoLogueado: loggedTimeStr || existingEntry.tiempoLogueado
                    });
                } else {
                    // Actualizar el turno programado por si cambió y actualizar tiempo logueado
                    await existingEntry.update({
                        horaEntradaProgramada: agent.horaEntradaProgramada,
                        tiempoLogueado: loggedTimeStr || existingEntry.tiempoLogueado
                    });
                }
            } else if (!recordedNames.has(agent.nombre)) {
                await Asistencia.create({
                    fecha: targetDate,
                    nombreAgente: agent.nombre,
                    campanaId: agent.campanaId,
                    horaEntradaProgramada: agent.horaEntradaProgramada,
                    horaEntradaReal: officialLoginTime,
                    minutosRetardo: delayMinutos,
                    impactoLlamadas: impacto,
                    estatusAsistencia: estatusAsistencia,
                    tiempoLogueado: loggedTimeStr || '00:00:00'
                });
            }
        }

    } catch (err) {
        console.error('Core sync error:', err.message);
    }
}


module.exports = router;
