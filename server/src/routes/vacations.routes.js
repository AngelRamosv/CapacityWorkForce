const express = require('express');
const router = express.Router();
const Vacacion = require('../models/Vacacion');

router.get('/vacations', async (req, res) => {
    try {
        const vacations = await Vacacion.findAll();
        res.json(vacations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/vacations', async (req, res) => {
    try {
        const vacation = await Vacacion.create(req.body);
        res.json(vacation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/vacations/:id', async (req, res) => {
    try {
        await Vacacion.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
