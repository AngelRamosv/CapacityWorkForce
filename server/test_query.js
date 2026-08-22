const mysql = require('mysql2/promise');
mysql.createConnection({
  host: '192.168.50.33',
  user: 'cyberhub',
  password: 'masterC1berHUb#',
  database: 'cyber_ideas_hub'
}).then(c => {
  return c.query("SELECT * FROM reporteProductividad WHERE DATE(FechaCaptura) = '2026-04-29' LIMIT 5")
    .then(([r]) => console.log(r))
    .finally(() => c.end());
}).catch(e => console.error(e));
