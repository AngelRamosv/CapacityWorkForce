const express = require('express');
const router = express.Router();
const Campana = require('../models/Campana');
const PlanSemanal = require('../models/PlanSemanal');
const WfmService = require('../services/WfmService');

// --- PLANES & SIMULACIÓN ---
router.get('/plans/:poolId', async (req, res) => {
    try {
        const plans = await PlanSemanal.findAll({
            where: { campanaId: req.params.poolId },
            order: [['anio', 'DESC'], ['numeroSemana', 'DESC']]
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/simulate', async (req, res) => {
    try {
        const { totalAgents, distribution, agentesNocturnos } = req.body;
        const effectiveTotal = (totalAgents || 0) - (agentesNocturnos || 0);
        const balance = WfmService.calculateZeroSumBalance(effectiveTotal, distribution);
        res.json(balance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/plans', async (req, res) => {
    try {
        const { poolId, weekNumber, year, distribution } = req.body;
        const pool = await Campana.findByPk(poolId);
        if (!pool) return res.status(404).json({ error: 'Campaña no encontrada' });

        const effectiveTotalAgents = (pool.totalAgentes || 0) - (pool.agentesNocturnos || 0);
        const balance = WfmService.calculateZeroSumBalance(effectiveTotalAgents, distribution);

        // Siempre crear un nuevo plan para mantener el histórico de versiones
        const plan = await PlanSemanal.create({ 
            campanaId: poolId, 
            numeroSemana: weekNumber, 
            anio: year, 
            distribucion: distribution 
        });
        
        res.json({ plan, balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/plans/:id', async (req, res) => {
    try {
        await PlanSemanal.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
