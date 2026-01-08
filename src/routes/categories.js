const { Router } = require('express');
const category = require('../controllers/categoryController')

const router = Router();

router.put('/category', category.pullZoohoCat)
router.put('/brand', category.pullBrand)

module.exports = router;