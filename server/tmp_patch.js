const fs = require('fs');

const apiPath = 'c:/Users/Sistemas/Desktop/WorkForce/server/src/routes/api.js';
let content = fs.readFileSync(apiPath, 'utf8');

const newRoute = `// Endpoint Inteligente para cálculo de Cobertura Intradía
router.get('/live/coverage', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const todayObj = new Date();
        const dayOfWeek = todayObj.getDay(); 

        let baseTotal = 3195;
        if (dayOfWeek === 6) baseTotal = 1500;
        else if (dayOfWeek === 0) baseTotal = 780;

        let todayVolume = baseTotal; 
        try {
            const hFile = path.join(__dirname, '../data/historicalVolume.json');
            if (fs.existsSync(hFile)) {
                const histData = JSON.parse(fs.readFileSync(hFile));
                const todayStr = todayObj.toISOString().split('T')[0];
                if (histData[todayStr]) {
                    const keys = Object.keys(histData[todayStr]).sort((a,b)=>Number(b)-Number(a));
                    if (keys.length > 0) todayVolume = Math.max(todayVolume, histData[todayStr][keys[0]]);
                }
            }
        } catch(e) {}

        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const nightVolumeExpected = todayVolume * 0.25; 

        const hourlyData = [];
        const baseCurve = [0.06, 0.08, 0.09, 0.09, 0.08, 0.07, 0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.05, 0.04, 0.04];
        for (let i = 0; i < 15; i++) {
            const h = 9 + i;
            hourlyData.push({
                hour: \`\${h}:00\`,
                calls: Math.round(todayVolume * baseCurve[i]),
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
            suggestion = \`✅ Operación de Fin de Semana. La regla de reacomodo estricto está apagada. Meta de hoy: \${baseTotal} llamadas.\`;
            state = 'verde';
        } else {
            if (deficit > 0) {
                suggestion = \`⚠️ Se espera alta demanda a partir de las 18:00 hrs. Faltan \${deficit} agentes. Recomendación: Mueve a \${deficit} agentes del turno 09:00 al turno Vespertino/Intermedio para evitar sobrecarga.\`;
                state = 'rojo';
            } else if (deficit <= 0) {
                suggestion = \`💡 Capacidad Nocturna Satisfactoria (Sobran \${Math.abs(deficit)} agentes). La cobertura de 6 PM a 11 PM está asegurada.\`;
                state = 'verde';
            }
        }

        res.json({
            required: agentesNecesariosTurno,
            actualScheduled: assignedNight.length,
            deficit: deficit,
            expectedCalls: Math.round(nightVolumeExpected),
            suggestion: suggestion,
            status: state,
            isWeekend: isWeekend,
            hourlyData: hourlyData
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});`;

const splitStr1 = '// Endpoint Inteligente para cálculo de Cobertura Intradía';
const splitStr2 = '// --- PLANES ---';

let parts1 = content.split(splitStr1);
let parts2 = parts1[1].split(splitStr2);

let newContent = parts1[0] + newRoute + "\n\n" + splitStr2 + parts2[1];
fs.writeFileSync(apiPath, newContent);
console.log('patched api.js');
