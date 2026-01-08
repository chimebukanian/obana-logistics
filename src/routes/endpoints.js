const {Router} = require('express');
const endpointController = require('../controllers/endpointController')

const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     create_endpoint:
 *       type: object
 *       required:
 *          - name
 *          - route
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the endpoint
 *         route:
 *           type: string
 *           description: The the endpoint uri
 *         verb:
 *           type: string
 *           description: The request method
 *         tenantId:
 *           type: integer
 *           description: The ID of the tenant that owns the endpoint
 *         parameters:
 *           type: object
 *           description: The parameters required to call the endpoint
 *         payload:
 *           type: object
 *           description: The payloads required to call the endpoint
 *         headers:
 *           type: object
 *           description: The headers required to call the endpoint
 *       example:
 *         name: Get Products
 *         slug: get-products
 *         route: /get-products
 *         parameters: 
 *          page: 1
 *         verb: post
 *         type: rest
 *         payload: 
 *          category: fashion
 *         headers: 
 *          content-type: application-json
 *         response: 
 *          name: item.name
 *         tenant: fazsion
 * 
 */

 /**
  * @swagger
  * tags:
  *   name: EndpointsAPI
  *   description: The endpoint management API
  */

/**
* @swagger
*  /endpoints/create:
*  post:
*    summary: Create endpoints
*    tags: [EndpointsAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/create_endpoint'
*    responses:
*      '201':
*        description: User created successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/create_endpoint'
*/
router.post('/create', endpointController.createEndpoint)


/**
* @swagger
*  /endpoints/update:
*  put:
*    summary: Update endpoints
*    tags: [EndpointsAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/create_endpoint'
*    responses:
*      '202':
*        description: A successful response
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/create_endpoint'
 */
router.put('/update', endpointController.updateEndpoint)

module.exports = router;