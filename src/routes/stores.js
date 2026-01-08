const {Router} = require('express');
const storeController = require('../controllers/storeController')
const auth = require('./auth')

const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     create_store:
 *       type: object
 *       required:
 *          - name
 *          - link
 *          - logo_url
 * 
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the store
 *         link:
 *           type: string
 *           description: The url to your store
 *         social_handles:
 *           type: object
 *           description: The social media handles of your business
 *         settlement_account:
 *           type: object
 *           description: The account detail to recieve your settlements
 *         logo_url:
 *           type: string
 *           description: URL to store image
 *       example:
 *         name: walef
 *         link: walef
 *         social_handles:
 *           facebook: 'http://facebook.com/elvis'
 *           instagram: 'http://instagram.com/elvis'
 *           twitter: 'http://twitter.com/elvis'
 *         settlement_account:
 *           account_name: 'Elvis Chukwu'
 *           bank: 'GTB'
 *           account: '0156864683'
 *         logo_url: 'www.cloudinary.com/ywiiewbjjewejkewe'
 *     remove_store_product:
 *       type: object
 *       required:
 *          - sku
 *       properties:
 *         sku:
 *           type: string
 *           description: The sku of the product
 *       example:
 *         sku: 1234567
 *     store_product_update:
 *       type: object
 *       required:
 *          - products
 *       properties:
 *         products:
 *           type: string
 *           description: The products to be updated
 *       example:
 *         products: [{product 1},{product 2}]
 *     store_product:
 *       type: object
 *       required:
 *          - sku
 *       properties:
 *         sku:
 *           type: string
 *           description: The sku of the product
 *         image:
 *           type: string
 *           description: The preffered product image
 *         general:
 *           type: object
 *           description: General details of the product
 *         inventry:
 *           type: object
 *           description: Inventory details of the product
 *         pricing:
 *           type: object
 *           description: General details of the product
 *         variant:
 *           type: object
 *           description: Varient details of the product
 *       example:
 *         sku: 1234567
 *         image: 'https://cloudinary.com/beurueuerhern'
 *         general:
 *           name: Nike Air
 *           prefered_name: Nike Air Cool
 *           category: Clothes
 *           description: Nike Air white huddy clothe
 *         inventry:
 *           quantity: 50
 *           allow_over_sale: true
 *         pricing:
 *           regular_price: 2000
 *           sale_price: 1500
 *           cost_per_item: 1000
 *         variant:
 *           Size: [small, medium, large]
 *           Color: [yellow, red, blue]
 *           options: [{option: "Small, Red, Oversize", price: 1000, status: In stock, stock: 150}]
 */

 /**
  * @swagger
  * tags:
  *   name: StoreAPI
  *   description: The store management API
  */

/**
* @swagger
*  /stores/create:
*  post:
*    summary: Create store
*    tags: [StoreAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/create_store'
*    responses:
*      '201':
*        description: Store created successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/create_store'
*/
router.post('/create', auth.authenticateToken, storeController.createStore)

/**
* @swagger
*  /stores/get-available-product:
*  get:
*    summary: Get Store
*    tags: [StoreAPI]
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
*        description: Product removed successfully from store
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/store_product'
*/
router.get('/get-available-product', auth.authenticateToken, storeController.getOrderedProducts)

/**
* @swagger
*  /stores/add-product:
*  post:
*    summary: Add Product To Store
*    tags: [StoreAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/store_product'
*    responses:
*      '201':
*        description: Product added successfully to store
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/store_product'
*/
router.post('/add-product', auth.authenticateToken, storeController.addProduct)

/**
* @swagger
*  /stores/add-product:
*  post:
*    summary: Add Product To Store
*    tags: [StoreAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/store_product_update'
*    responses:
*      '201':
*        description: Product added successfully to store
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/store_product'
*/
router.post('/update-product-status', auth.authenticateToken, storeController.updateProductsStatus)

/**
* @swagger
*  /stores/remove-product:
*  put:
*    summary: Remove Product From Store
*    tags: [StoreAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/remove_store_product'
*    responses:
*      '200':
*        description: Product removed successfully from store
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/remove_store_product'
*/
router.put('/remove-product', auth.authenticateToken, storeController.removeProduct)

/**
* @swagger
*  /stores/:
*  get:
*    summary: Get Store
*    tags: [StoreAPI]
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
*        description: Product removed successfully from store
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/store_product'
*/
router.get('/', auth.authenticateToken, storeController.getStore)


module.exports = router;