const fs = require('fs');
const apiPath = 'c:/Users/Sistemas/Desktop/WorkForce/server/src/routes/api.js';
let content = fs.readFileSync(apiPath, 'utf8');

const targetStr = `        res.json({
            required: agentesNecesariosTurno,
            actualScheduled: assignedNight.length,
            deficit: deficit,
            expectedCalls: Math.round(nightVolumeExpected),
            suggestion: suggestion,
            status: state,
            isWeekend: isWeekend,
            hourlyData: hourlyData
        });`;

const replacement = `        res.json({
            required: agentesNecesariosTurno,
            actualScheduled: assignedNight.length,
            deficit: deficit,
            expectedCalls: Math.round(nightVolumeExpected),
            suggestion: suggestion,
            status: state,
            isWeekend: isWeekend,
            hourlyData: hourlyData,
            dailyGoal: baseTotal,
            averageExpectedPerHour: Math.round(baseTotal / 15)
        });`;

fs.writeFileSync(apiPath, content.replace(targetStr, replacement));
console.log('Patched expectedCalls in api.js');
