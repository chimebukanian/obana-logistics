const { Router } = require('express');
const productController = require('../controllers/productController')
const auth = require('./auth')

const router = Router();

router.get('/', (req, res) => {
    res.status(200)
})

router.put('/:route/:endpoint', auth.authenticateToken, productController.productSampleRequest)
router.get('/:route/:endpoint', auth.authenticateToken, productController.productSampleRequest)
router.post('/:route/:endpoint', auth.authenticateToken, productController.productSampleRequest)

module.exports = router;