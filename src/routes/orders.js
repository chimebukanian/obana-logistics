const { Router } = require('express');
const orderController = require('../controllers/orderController')
const auth = require('./auth')

const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     get_orders:
 *       type: object
 * 
 *     update_order:
 *       type: object
 *       required:
 *          - orderId
 *          - status
 *       properties:
 *         orderId:
 *           type: string
 *           description: The id of the order to be updated
 *         status:
 *           type: string
 *           description: The status to update the order to
 *       example:
 *         orderId: "243547"
 *         status: "completed"
 */

/**
* @swagger
*  /orders/:
*  get:
*    summary: Get Orders
*    tags: [OrderDetailsAPI]
*    parameters:
*      - in: header
*        name: authorization
*        description: token to be passed as a header
*        required: true
*        schema:
*          type: string
*    requestBody:
*       required: false
*    responses:
*      '200':
*        description: Customer orders fetched successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/get_orders'
*/
router.get('/', auth.authenticateToken, orderController.getCustomerOrders)
router.get('/admin', auth.authenticateToken, orderController.getAdminOrders)




/**
* @swagger
*  /orders/update-order:
*  put:
*    summary: Update customers order status
*    tags: [OrderDetailsAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/update_order'
*    responses:
*      '200':
*        description: Product added successfully to store
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/update_order'
*/
router.put('/update-order', orderController.updateOrder)

// router.post('/order', auth.authenticateToken, orderController.createOrder)

module.exports = router;