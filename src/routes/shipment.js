const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const webhookController = require('../controllers/webhookController');
const auth = require('./auth')


// Shipment management routes
router.get('/',  auth.authenticateToken, shipmentController.getAllShipments);
router.get('/stats', auth.authenticateToken, shipmentController.getShipmentStats);
router.get('/order/:orderId',  auth.authenticateToken, shipmentController.getShipmentsByOrderId);
router.get('/:id',  auth.authenticateToken, shipmentController.getShipmentById);
router.get('/:id/tracking',  auth.authenticateToken, shipmentController.getShipmentTracking);
router.put('/:id/status',  auth.authenticateToken, shipmentController.updateShipmentStatus);

// Webhook routes
router.get('/webhooks/logs', webhookController.getWebhookLogs);

module.exports = router;