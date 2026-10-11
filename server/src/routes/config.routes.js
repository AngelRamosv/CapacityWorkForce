const express = require('express');
const router = express.Router();
const Configuracion = require('../models/Configuracion');

router.get('/config', async (req, res) => {
    try {
        const config = await Configuracion.findOne();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/config', async (req, res) => {
    try {
        const { shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos } = req.body;
        let config = await Configuracion.findOne();
        if (!config) {
            config = await Configuracion.create({ shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos });
        } else {
            await config.update({ shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
