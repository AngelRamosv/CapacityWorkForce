const mysql = require('mysql2/promise');

(async () => {
    try {
        const c = await mysql.createConnection({
            host: '192.168.50.33',
            user: 'cyberhub',
            password: 'masterC1berHUb#',
            database: 'cyber_ideas_hub'
        });

        const [r1] = await c.query("SELECT DATE(FechaCaptura) as f, COUNT(*) as count FROM reporteProductividad GROUP BY DATE(FechaCaptura) ORDER BY f DESC LIMIT 10");
        console.log("Recent dates in DB:");
        console.table(r1);

        const [r2] = await c.query("SELECT COUNT(*) as count FROM reporteProductividad WHERE DATE(FechaCaptura) = CURDATE()");
        console.log(`Records for today (CURDATE()): ${r2[0].count}`);

        const [r3] = await c.query("SELECT MAX(FechaCaptura) as last FROM reporteProductividad");
        console.log("Last record ever:", r3[0].last);

        await c.end();
    } catch (e) {
        console.error(e);
    }
})();
