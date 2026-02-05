const { Router } = require('express');
const verificationController = require('../controllers/verificationController')
const auth = require('./auth')

const router = Router();
/**
* @swagger
 * components:
 *   schemas:
 *     verify_details:
 *       type: object
 *       required:
 *          - request_id
 *          - otp
 *       properties:
 *         request_id:
 *           type: string
 *           description: The id of the request
 *         otp:
 *           type: string
 *           description: The otp for the password reset request
 *         password:
 *           type: string
 *           description: The the new password - Optional
 *       example:
 *         request_id: "fgfhjrywuyejjeuwe743hjweewhuuwebn3uy"
 *         otp: "5674"
 *         password: "(Optional - Needed only in reset password verification)"
 *         remember_me: 1
 */

/**
 * @swagger
 * tags:
 *   name: VerificationAPI
 *   description: The request verification API
 */

/**
 * @swagger
 * /verify/otp:
 *   post:
 *     summary: Used to verify and authenticate requests
 *     tags: [VerificationAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/verify_details'
 *     responses:
 *       200:
 *         description: Request is aunthenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/verify_details'
 *       401:
 *          description: Request aunthenticated failed
*/


router.post('/otp', verificationController.verifyOTP)
router.get('/otp', verificationController.getOtp)


module.exports = router;