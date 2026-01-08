const { Router } = require('express');
const wishController = require('../controllers/wishController')
const auth = require('../routes/auth')

const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     wish_product:
 *       type: object
 *       required:
 *          - sku
 *       properties:
 *         sku:
 *           type: string
 *           description: The sku of the product
 *       example:
 *         sku: 1234567
 */

/**
 * @swagger
 * tags:
 *   name: WishAPI
 *   description: The wish management API
 */


/**
* @swagger
*  /wish/add-product:
*  put:
*    summary: Add Product To Wish list
*    tags: [WishAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/wish_product'
*    responses:
*      '200':
*        description: Product added successfully to wish list
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/wish_product'
*/
router.post('/add-product', auth.authenticateToken, wishController.addProduct)

/**
* @swagger
*  /wish/remove-product:
*  put:
*    summary: Remove Product From Wish List
*    tags: [WishAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/wish_product'
*    responses:
*      '200':
*        description: Product removed successfully from wish list
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/wish_product'
*/
router.put('/remove-product', auth.authenticateToken, wishController.removeProduct)

/**
* @swagger
*  /wish/list:
*  get:
*    summary: Get Wish List
*    tags: [WishAPI]
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
*        description: Product removed successfully from wish
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/wish_product'
*/
router.get('/list', auth.authenticateToken, wishController.getWishList)


module.exports = router;