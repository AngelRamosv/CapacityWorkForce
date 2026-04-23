const fs = require('fs');
const apiPath = 'c:/Users/Sistemas/Desktop/WorkForce/server/src/routes/api.js';
let content = fs.readFileSync(apiPath, 'utf8');

const targetLogic = `        const todayObj = new Date();
        const dayOfWeek = todayObj.getDay(); 

        let baseTotal = 3195;
        if (dayOfWeek === 6) baseTotal = 1500;
        else if (dayOfWeek === 0) baseTotal = 780;

        let todayVolume = baseTotal; 
        let histData = {};
        try {
            const hFile = path.join(__dirname, '../data/historicalVolume.json');
            if (fs.existsSync(hFile)) {
                histData = JSON.parse(fs.readFileSync(hFile));
                const todayStr = todayObj.toISOString().split('T')[0];
                if (histData[todayStr]) {
                    const keys = Object.keys(histData[todayStr]).sort((a,b)=>Number(b)-Number(a));
                    if (keys.length > 0) todayVolume = Math.max(todayVolume, histData[todayStr][keys[0]]);
                }
            }
        } catch(e) {}

        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const nightVolumeExpected = todayVolume * 0.25; 

        const todayStr = todayObj.toISOString().split('T')[0];
        let todayHist = histData[todayStr] || null;

        const hourlyData = [];
        const baseCurve = [0.06, 0.08, 0.09, 0.09, 0.08, 0.07, 0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.05, 0.04, 0.04];
        const currentHour = todayObj.getHours();`;

const replacementLogic = `        const todayObj = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const dayOfWeek = todayObj.getDay(); 
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const currentHour = todayObj.getHours();

        let baseTotal = 3195;
        if (dayOfWeek === 6) baseTotal = 1500;
        else if (dayOfWeek === 0) baseTotal = 780;

        let todayVolume = baseTotal; 
        let histData = {};
        try {
            const hFile = path.join(__dirname, '../data/historicalVolume.json');
            if (fs.existsSync(hFile)) {
                histData = JSON.parse(fs.readFileSync(hFile));
                if (histData[todayStr]) {
                    const keys = Object.keys(histData[todayStr]).sort((a,b)=>Number(b)-Number(a));
                    if (keys.length > 0) todayVolume = Math.max(todayVolume, histData[todayStr][keys[0]]);
                }
            }
        } catch(e) {}

        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const nightVolumeExpected = todayVolume * 0.25; 

        let todayHist = histData[todayStr] || null;

        const hourlyData = [];
        const baseCurve = [0.06, 0.08, 0.09, 0.09, 0.08, 0.07, 0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.05, 0.04, 0.04];`;

content = content.replace(targetLogic, replacementLogic);
fs.writeFileSync(apiPath, content);
console.log('Fixed timezone issue in api.js');
