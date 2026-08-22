const Asistencia = require('./src/models/Asistencia');
const sequelize = require('sequelize');

Asistencia.update({
    horaEntradaReal: sequelize.col('horaEntradaProgramada'),
    minutosRetardo: 0,
    impactoLlamadas: 0,
    estatusAsistencia: 'A Tiempo'
}, {
    where: { fecha: '2026-04-29', estatusAsistencia: 'Retardo' }
}).then(res => console.log('Fixed:', res)).catch(e => console.error(e));
