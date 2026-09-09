// routes/kpis.routes.js — Routes Dashboard KPIs
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { requireRoles } = require('../middleware/requireRoles');
const ctrl = require('../controllers/kpisController');
const reportCtrl = require('../controllers/reportController');

// Tous les KPIs du dashboard admin
router.get('/admin/kpis', authenticate, requireRoles('super_admin', 'admin', 'staff'), ctrl.getAdminKpis);
router.get('/admin/kpis/revenue-chart', authenticate, requireRoles('super_admin', 'admin', 'staff'), ctrl.getRevenueChart);

// Rapport intelligent (IA embarquée) — Admin Coworking
router.get('/admin/report', authenticate, requireRoles('super_admin', 'admin', 'staff'), reportCtrl.getAdminReport);

module.exports = router;
