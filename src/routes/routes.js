const express = require('express')
const router = express.Router()
const controller = require('../controllers/routesController')

router.get('/', controller.listTemplates)
router.post('/', controller.createTemplate)
router.get('/:id', controller.getTemplate)
router.put('/:id', controller.updateTemplate)
router.delete('/:id', controller.deleteTemplate)

// Matching endpoint
router.post('/match', controller.matchTemplate)

module.exports = router
