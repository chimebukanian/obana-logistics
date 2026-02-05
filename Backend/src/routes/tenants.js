const {Router} = require('express');
const tenantController = require('../controllers/tenantController')

const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     create_tenant:
 *       type: object
 *       required:
 *          - name
 *          - base_url
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the tenant
 *         base_url:
 *           type: string
 *           description: The base url of the tenant
 *         description:
 *           type: string
 *           description: The description of the services the tenant provides
 *         status:
 *           type: string
 *           description: Status of the tenant on our platform
 *         config:
 *           type: object
 *           description: Specific configuration settings for the tenant
 *       example:
 *         name: Faszion
 *         slug: faszion
 *         base_url: http://fazsion.com/api
 *         description: Fazsion API
 *         status: Enabled
 *         config: 
 *         registry: 
 */

 /**
  * @swagger
  * tags:
  *   name: TenantAPI
  *   description: The tenant management API
  */

/**
* @swagger
*  /tenants/create:
*  post:
*    summary: Create tenant
*    tags: [TenantAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/create_tenant'
*    responses:
*      '201':
*        description: Tenant created successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/create_tenant'
*/
router.post('/create', tenantController.createTenant)


/**
* @swagger
*  /tenants/update:
*  put:
*    summary: Updtae Tenant
*    tags: [TenantAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/create_tenant'
*    responses:
*      '200':
*        description: Tenant updated successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/create_tenant'
 */
router.put('/update', tenantController.updateTenant)


module.exports = router;