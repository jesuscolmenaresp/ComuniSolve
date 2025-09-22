const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Dashboards con roles
router.get('/admin', authMiddleware, roleMiddleware([1]), dashboardController.admin);
router.get('/lider', authMiddleware, roleMiddleware([2]), dashboardController.lider);
router.get('/jefe', authMiddleware, roleMiddleware([3]), dashboardController.jefe);

module.exports = router;
