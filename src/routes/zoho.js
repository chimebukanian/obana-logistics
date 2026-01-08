const { Router } = require('express');
const zohoController = require('../controllers/zohoController')
const auth = require('../routes/auth')

const router = Router();

router.put('/images', zohoController.updateZohoProductImage)



module.exports = router;
