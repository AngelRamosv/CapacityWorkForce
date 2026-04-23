const mysql = require('mysql2/promise');

(async () => {
    try {
        const prodConn = await mysql.createConnection({
            host: '192.168.50.33',
            user: 'cyberhub',
            password: 'masterC1berHUb#',
            database: 'cyber_ideas_hub',
            connectTimeout: 5000
        });

        const targetTables = ['campanias', 'izzi_conf_data', 'config_percep_deduc', 'reporte_generator', 'izzi_caso_negocio'];
        for (const t of targetTables) {
            try {
                const [cols] = await prodConn.query(`SHOW COLUMNS FROM ??`, [t]);
                console.log(`\n-- Columnas en la tabla: ${t} --`);
                console.log(cols.map(c => c.Field).join(', '));
            } catch (e) {
                console.log(`\nNo pude leer ${t}`);
            }
        }

        console.log("\n=====================");
        console.log("Muestra de CAMPANIAS:");
        try {
            const [rows] = await prodConn.query("SELECT * FROM campanias LIMIT 1");
            console.log(rows);
        } catch (e) { }

        prodConn.end();
    } catch (e) {
        console.error("Error MySQL:", e.message);
        process.exit(1);
    }
})();
