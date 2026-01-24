const express = require('express');
const router = express.Router();
const db = require('../models/db.js')
const shipmentController = require('../controllers/shipmentsController');
const controller =  shipmentController
    
    
    router.post('', controller.createShipment);
    
    
    router.get('/:shipment_reference', controller.getShipment);
    
    
    router.get('/users/:user_id', controller.getUserShipments);
    
    
    // router.post('/webhooks/:carrier', controller.handleCarrierWebhook);
    router.put('/status/:shipment_id', controller.updateShipmentStatus);


    router.post('/cancel/:shipment_id', controller.cancelShipment);
    
router.get('', controller.getAllShipments);
    
    
module.exports = router;
