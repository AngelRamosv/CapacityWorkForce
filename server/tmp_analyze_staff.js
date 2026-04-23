const xlsx = require('xlsx');
const path = require('path');

const args = process.argv.slice(2);
const fileName = args.length > 0 ? args[0] : 'STAFF.xlsx';
const filePath = path.join(__dirname, '../', fileName);

try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    let retencion = 0;
    let movil = 0;

    data.forEach(row => {
        const rowValues = Object.values(row).map(v => (v || '').toString().toLowerCase());
        const rowStr = rowValues.join(' ');
        const isMovil = rowStr.includes('movil') || rowStr.includes('móvil');

        if (isMovil) {
            movil++;
        } else {
            retencion++;
        }
    });

    console.log(`=== Resultados de ${fileName} ===`);
    console.log(`Total de registros en el Excel: ${data.length}`);
    console.log(`Campaña Retención: ${retencion} agentes`);
    console.log(`Campaña Móvil: ${movil} agentes`);
} catch (e) {
    console.error(`Error procesando el archivo: ${e.message}`);
}
