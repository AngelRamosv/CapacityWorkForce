const mysql = require('mysql2/promise');
const { Op } = require('sequelize');
const Agente = require('../models/Agente');
const Asistencia = require('../models/Asistencia');
const Configuracion = require('../models/Configuracion');

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

module.exports = { syncAttendanceFromCentral };
