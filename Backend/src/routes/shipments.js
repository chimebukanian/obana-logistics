const express = require('express');
const router = express.Router();
const db = require('../models/db.js')
const shipmentController = require('../controllers/shipmentsController');
const auth = require('../routes/auth');
const controller =  shipmentController
    
    
    router.post('', auth.authenticateToken,  controller.createShipment);
    
    
    router.get('/track/:shipment_reference', auth.authenticateToken, controller.getShipment);
    
    
    router.get('/users/:user_id', auth.authenticateToken, auth.verifyRole(['admin', 'driver',  'customer']), controller.getUserShipments);
    
    
    // router.post('/webhooks/:carrier', controller.handleCarrierWebhook);
    router.put('/status/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin','driver']), controller.updateShipmentStatus);


    router.post('/cancel/:shipment_id', auth.authenticateToken, auth.verifyRole(['admin', 'customer']), controller.cancelShipment);
    
    router.get('/admin/stats', auth.authenticateToken, auth.verifyRole(['admin']), controller.getAdminStats);
    router.get('', auth.authenticateToken, auth.verifyRole(['admin']), controller.getAllShipments);
    
    
module.exports = router;
