const express = require('express');
const router = express.Router();

const poolsRoutes = require('./pools.routes');
const configRoutes = require('./config.routes');
const staffRoutes = require('./staff.routes');
const vacationsRoutes = require('./vacations.routes');
const liveRoutes = require('./live.routes');
const plansRoutes = require('./plans.routes');
const reportsRoutes = require('./reports.routes');

// Montaje de rutas modulares (Spec-Driven Architecture)
router.use(poolsRoutes);
router.use(configRoutes);
router.use(staffRoutes);
router.use(vacationsRoutes);
router.use(liveRoutes);
router.use(plansRoutes);
router.use(reportsRoutes);

module.exports = router;
