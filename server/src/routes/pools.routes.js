const express = require('express');
const router = express.Router();
const Campana = require('../models/Campana');

router.get('/pools', async (req, res) => {
    try {
        const campanas = await Campana.findAll();
        res.json(campanas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/pools/:id', async (req, res) => {
    try {
        const { totalAgentes, agentesNocturnos } = req.body;
        const campana = await Campana.findByPk(req.params.id);
        if (!campana) return res.status(404).json({ error: 'Campaña no encontrada' });

        if (totalAgentes !== undefined) campana.totalAgentes = totalAgentes;
        if (agentesNocturnos !== undefined) campana.agentesNocturnos = agentesNocturnos;

        await campana.save();
        res.json(campana);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
