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

        const [tables] = await prodConn.query('SHOW TABLES');
        const list = tables.map(t => Object.values(t)[0]);
        console.log("=== TABLAS EN CYBERHUB ===");
        console.log(list.join('\n'));
        prodConn.end();
    } catch (e) {
        console.error("Error MySQL:", e.message);
        process.exit(1);
    }
})();
