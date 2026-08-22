const mysql = require('mysql2/promise');
const axios = require('axios');
const Agente = require('./src/models/Agente');

const userAgents = [
'Perez Quijano Alberto', 'Narciso Espinosa Ayali Marisol', 'Álvarez García Valery', 'Jardon Olguin Luis Fernando', 'Correa Morales Jesus Emmanuel', 'Garcia Ramirez Francisco Alberto', 'Hernandez Olvera Daniel Antonio', 'Peña Villicaña Alfonso', 'Nava Ponce Nestor Emmanuel', 'Reyes Medellin Yadira', 'Lopez Rodriguez Luis Manuel', 'Beltran Balcazar Alejandra', 'PICHARDO MACIAS JOANA VIVIANA', 'Camacho Trejo Maria Angela', 'Perez Zuñiga Cruz Manuel Efren', 'Rojas Cruz Blanca Estela', 'Rosas Sanchez Cesar Octavio', 'Zenteno Ramirez Dylan Jesus', 'Soto Mimila Genaro Antonio', 'Varas Villagran Ramses Mauricio', 'Cardelas Nabor Ruth', 'Nicolas Martinez Cristina Yuriria', 'Monroy Juarez Ali Guadalupe', 'Cruz Isidro Haydee', 'Ruiz Cano Paola Estefani', 'Sanchez Santiago Jorge', 'Prisca Abril Barrera osornio', 'Isis Alejandra Albañil De La Cruz', 'Arteaga Aguilera Jazmin Ariadna', 'Aragon Zamudio Emma De Los Angeles', 'Martinez Arias Elizabeth Adriana', 'Muratalla Perez Jonathan Uriel', 'Bello Moranchel Gael Rodolfo', 'Carmona Mares Juan Carlos', 'Bastida Beltran Janet', 'Reyes Sosa Kelvin Gerardo', 'Carpio Jimenez Pablo', 'Bautista Avila Daily', 'Rodriguez Luna Ximena Josefina Valeria', 'SANTIAGO IBAÑEZ MARIEL ANTONIETA', 'HERNANDEZ VARELA ALAN', 'Cervantes Balcazar Celia Lizeth', 'Anaya Calderon Jorge', 'Victor Ramses Martinez Arguello', 'Mena Olmos Isac', 'Jimenez Maya Brenda Berenice', 'Reyes Gonzalez Saul', 'Sanchez Granados Yael Alberto', 'SERRALDE CARRILLO LILIAN CITLALLI', 'GARCIA RIVERA GERARDO', 'ALVAREZ VAZQUEZ JOSHUA JAASIEL', 'VERA FORTIS LAEL'
];

async function analyze() {
    let liveData = [];
    try {
        const res = await axios.get('http://192.168.48.183:8050/data');
        if (res.data && res.data.nombres) {
            liveData = res.data.nombres.map((n, i) => {
                const parts = n.split(' - ');
                return {
                    id: parts[0] ? parts[0].trim() : '',
                    valor: res.data.valores[i]
                };
            });
        }
    } catch(e) {}

    let histData = [];
    try {
        const conn = await mysql.createConnection({ host: '192.168.50.33', user: 'cyberhub', password: 'masterC1berHUb#', database: 'cyber_ideas_hub' });
        const [rows] = await conn.execute('SELECT numero_agente, tiempo_logueado FROM reporteProductividad WHERE DATE(FechaCaptura) = ?', ['2026-05-03']);
        histData = rows;
        await conn.end();
    } catch(e) {}

    let output = '| Agente Local | ID | Tiempo Logueado | Hora Entrada Real (Calculada) | Resultado de Búsqueda |\n|---|---|---|---|---|\n';

    const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    
    for (const rawName of userAgents) {
        const localName = rawName.trim().replace(/\s+/g, ' ');
        const agent = await Agente.findOne({ where: { nombre: localName } });
        const localId = agent ? String(agent.numero_agente).replace(/\D/g, '') : 'NO_DB';
        const rawSchedule = agent ? (agent.horaEntradaProgramada || '11:00') : '11:00';

        let loggedTime = '-';
        let status = 'NO ENCONTRADO O ROBADO';
        let horaEntrada = '-';
        let totalSeconds = 0;

        let hMatch = histData.find(h => String(h.numero_agente).trim() === localId);
        if (hMatch) {
            loggedTime = hMatch.tiempo_logueado;
            status = 'MATCH PERFECTO';
            const [h, m, s] = loggedTime.split(':').map(Number);
            totalSeconds = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
        } else {
            let lMatch = liveData.find(l => l.id === localId);
            if (lMatch) {
                const rawVal = lMatch.valor;
                if (typeof rawVal === 'number') {
                    totalSeconds = Math.round(rawVal * 3600);
                    const h = Math.floor(totalSeconds / 3600);
                    const m = Math.floor((totalSeconds % 3600) / 60);
                    const s = totalSeconds % 60;
                    loggedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                    status = 'MATCH PERFECTO';
                }
            }
        }

        if (totalSeconds > 0) {
            const loginDate = new Date(nowMx.getTime() - totalSeconds * 1000);
            const calcH = loginDate.getHours();
            const calcM = loginDate.getMinutes();
            horaEntrada = `${String(calcH).padStart(2, '0')}:${String(calcM).padStart(2, '0')}`;
        } else {
            horaEntrada = rawSchedule + ' (Ausente/Pendiente)';
            loggedTime = '00:00:00';
            if (status !== 'MATCH PERFECTO') {
               status = '🛑 INTENTO DE ROBO BLOQUEADO';
            }
        }

        output += `| ${localName} | ${localId} | ${loggedTime} | ${horaEntrada} | ${status} |\n`;
    }

    require('fs').writeFileSync('analysis_results_11.md', output);
    console.log('Done');
}
analyze().catch(console.error);
