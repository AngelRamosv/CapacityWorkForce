const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../Staff.xlsx');

try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    const possibleColumns = ['turno', 'horario', 'entrada', 'salida', 'jornada', 'shift', 'schedule', 'time'];
    let errors = [];

    for (const row of data) {
        let isNocturno = false;
        let scheduledTime = '09:00';
        let shiftName = 'Matutino';
        let timeFound = false;

        for (const key of Object.keys(row)) {
            const val = (row[key] || '').toString().toLowerCase().trim(); // AÑADIDO TRIM()
            const keyLow = key.toLowerCase();
            if (possibleColumns.some(pc => keyLow.includes(pc))) {
                const timeMatch = val.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]/);
                if (timeMatch) {
                    scheduledTime = timeMatch[0];
                    timeFound = true;
                    break;
                }
            }
        }

        if (!timeFound) {
            const turnoDirecto = (row['Turno'] || row['turno'] || row['TURNO'] || '').toString().trim();
            if (turnoDirecto) {
                const turnoLow = turnoDirecto.toLowerCase();
                if (turnoLow.includes('nocturno') || turnoLow.includes('noche')) {
                    scheduledTime = '23:00';
                } else if (turnoLow.includes('vespertino') || turnoLow.includes('tarde')) {
                    scheduledTime = '11:00';
                } else {
                    scheduledTime = '09:00';
                }
            }
        }

        if (!['09:00', '10:00', '11:00', '23:00'].includes(scheduledTime)) {
            errors.push(scheduledTime);
        }
    }
    console.log("Unmatched times:", [...new Set(errors)]);
} catch (e) {
    console.error(e.message);
}
