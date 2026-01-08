const { Router } = require('express');
const notificationController = require('../controllers/nitificationlController')
const auth = require('./auth')

const router = Router();

router.post('/send', auth.authenticateToken, notificationController.sendMail)
module.exports = router