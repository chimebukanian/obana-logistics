const { Router } = require('express')
const requestController = require('../controllers/requestController')
const auth = require('./auth')

const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     request_detailes:
 *       type: object
 *       required:
 *        
 */

/**
 * @swagger
 * tags:
 *   name: RequestsAPI
 *   description: The request management API
 */

/**
 * @swagger
 *  /requests/:tenant/:endpoint:
 *   post:
 *     summary: Makes a post request to the specified tenant at the the given endpoint
 *     tags: [RequestsAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/request_detailes'
 *     responses:
 *       200:
 *         description: Put request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/request_detailes'
 *       500:
 *          description: Internal Server Error
*/
router.post('/:tenant/:endpoint', auth.authenticateToken, requestController.makeRequest)


/**
 * @swagger
 *  /requests/:tenant/:endpoint:
 *   get:
 *     summary: Makes a get request to the specified tenant at the the given endpoint
 *     tags: [RequestsAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/request_detailes'
 *     responses:
 *       200:
 *         description: Put request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/request_detailes'
 *       500:
 *          description: Internal Server Error
*/
router.get('/:tenant/:endpoint', auth.authenticateToken, requestController.makeRequest)


/**
 * @swagger
 *  /requests/:tenant/:endpoint:
 *   put:
 *     summary: Makes a put request to the specified tenant at the the given endpoint
 *     tags: [RequestsAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/request_detailes'
 *     responses:
 *       200:
 *         description: Put request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/request_detailes'
 *       500:
 *          description: Internal Server Error
*/
router.put('/:tenant/:endpoint', auth.authenticateToken, requestController.makeRequest)

/**
 * @swagger
 *  /requests/:tenant/:endpoint:
 *   delete:
 *     summary: Makes a delete request to the specified tenant at the the given endpoint
 *     tags: [RequestsAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/request_detailes'
 *     responses:
 *       200:
 *         description: Delete request successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/request_detailes'
 *       500:
 *          description: Internal Server Error
*/
router.delete('/:tenant/:endpoint', auth.authenticateToken, requestController.makeRequest)

router.post('/:endpoint', requestController.webHooks)
router.put('/sync-order', requestController.syncZohoOrder)

module.exports = router;
