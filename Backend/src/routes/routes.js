const express = require('express')
const router = express.Router()
const controller = require('../controllers/routesController')
const auth = require('../routes/auth')

router.get('/', auth.authenticateToken, auth.verifyRole(['admin']), controller.listTemplates)
router.post('/', auth.authenticateToken, auth.verifyRole(['admin']), controller.createTemplate)
router.get('/:id', auth.authenticateToken, auth.verifyRole(['admin']), controller.getTemplate)
router.put('/:id', auth.authenticateToken, auth.verifyRole(['admin']), controller.updateTemplate)
router.delete('/:id', auth.authenticateToken, auth.verifyRole(['admin']), controller.deleteTemplate)

// Matching endpoint
router.post('/match', auth.authenticateToken, controller.matchTemplate)

module.exports = router
