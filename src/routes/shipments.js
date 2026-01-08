const express = require('express');
const router = express.Router();

module.exports = (db) => {
    const ShipmentController = require('./shipmentController');
    const controller = new ShipmentController(db);
    
    router.post('/shipments', controller.createShipment.bind(controller));
    
    
    router.get('/shipments/:shipment_reference/status', controller.getShipmentStatus.bind(controller));
    
    
    router.post('/shipments/:shipment_id/cancel', controller.cancelShipment.bind(controller));
    
    
    router.post('/webhooks/:carrier/updates', (req, res) => {
       
        console.log(`Webhook from ${req.params.carrier}:`, req.body);
        res.status(200).json({ received: true });
    });
    
    return router;
};