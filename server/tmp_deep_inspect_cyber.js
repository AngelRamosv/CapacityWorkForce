const axios = require('axios');
const mysql = require('mysql2/promise');

(async () => {
    console.log("================================");
    console.log("1. INSPECCIONANDO LA API CENTRAL");
    console.log("================================");
    try {
        const response = await axios.get('http://192.168.48.183:8050/data', { timeout: 5000 });
        const keys = Object.keys(response.data);
        console.log("Llaves que expone la API en vivo:");
        keys.forEach(k => {
            const val = response.data[k];
            if (Array.isArray(val)) {
                console.log(` - ${k} (Arreglo con ${val.length} elementos)`);
            } else if (typeof val === 'object' && val !== null) {
                console.log(` - ${k} (Objeto complejo)`);
            } else {
                console.log(` - ${k}: ${val}`);
            }
        });
    } catch (e) {
        console.log("Error al conectar con la API:", e.message);
    }

    console.log("\n================================");
    console.log("2. INSPECCIONANDO LA BASE MYSQL");
    console.log("================================");
    try {
        const prodConn = await mysql.createConnection({
            host: '192.168.50.33',
            user: 'cyberhub',
            password: 'masterC1berHUb#',
            database: 'cyber_ideas_hub'
        });

        const [tables] = await prodConn.query('SHOW TABLES');
        const list = tables.map(t => Object.values(t)[0]);
        console.log("TABLAS DISPONIBLES EN LA BASE:");
        console.log(list.join(', '));

        // Si hay una tabla que suene a meta o configuracion, extraer columnas
        const targetTables = list.filter(t => t.toLowerCase().includes('meta') || t.toLowerCase().includes('config') || t.toLowerCase().includes('campa') || t.toLowerCase().includes('volumen'));
        for (const t of targetTables) {
            console.log(`\n-- Columnas en la tabla: ${t} --`);
            const [cols] = await prodConn.query(`SHOW COLUMNS FROM ??`, [t]);
            console.log(cols.map(c => c.Field).join(', '));
        }

        prodConn.end();
    } catch (e) {
        console.log("Error MySQL:", e.message);
    }
})();
