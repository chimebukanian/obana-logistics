const { Router } = require('express');
const userController = require('../controllers/userController');
const auth = require('../routes/auth');
const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     signup_details:
 *       type: object
 *       required:
 *          - email
 *          - phone
 *          - password
 *          - role
 *       properties:
 *         email:
 *           type: string
 *           description: The email address of the user
 *         phone:
 *           type: string
 *           description: The phone number of the user
 *         password:
 *           type: string
 *           description: The password of the user
 *         role:
 *           type: string
 *           enum: [admin, driver, customer]
 *           description: User role
 *         driver_id:
 *           type: integer
 *           description: Driver ID (only required if role is driver)
 *       example:
 *         email: user@example.com
 *         phone: '08160581957'
 *         password: Password@1
 *         role: customer
 * 
 *     reset_password_details:
 *       type: object
 *       required:
 *          - user_identification
 *       properties:
 *         user_identification:
 *           type: string
 *           description: The email or phone number of the user
 *       example:
 *         user_identification: "elvisonyedika@gmail.com"
 * 
 *     token_details:
 *       type: object
 *       required:
 *          - refresh_token
 *       properties:
 *         refresh_token:
 *           type: string
 *           description: The refresh token for the user
 *       example:
 *         refresh_token: "dchghgcxyrsdytfjygur77y8yu9u8ygibbncxdtyuyukhbnu08y9ohukjbnnbvfhtdjhfytd5e65w35xszzrarsgxmnhfrtdyuy"
 * 
 *     auth_details:
 *       type: object
 *       required:
 *          - user_identification
 *          - password
 *       properties:
 *         user_identification:
 *           type: string
 *           description: The email address or phone number of the user
 *         password:
 *           type: string
 *           description: The password of the user
 *       example:
 *         user_identification: "08160581957"
 *         password: Password@1
 * 
 *     profile_details:
 *       type: object
 *       example:
 *         user_information:
 *          first_name: Elvis
 *          last_name: Chukwu
 *          location: Nigeria
 *          language: ENglish
 *          user_imgage: "https://tajiri.xyz/images"
 *         partner_information:
 *          title: Mr
 *          full_name: Chukwu Elvis
 *          phone: 08160581957
 *          state: Lagos
 *          lga: Eti-Osa
 *          full_address: '1, Mushafau Lasisi, Street'
 *          landmark: Igbo-Efon
 *          birthday: '01/01/1990'
 *          creation_source: facebook
 *          partner_imgage: "https://tajiri.xyz/images"
 *         payment_information:
 *          bank_name: GTB
 *          account_name: Chukwu Elvis
 *          account_number: '0101847426'
 *         training:
 *          score: 80%
 *          certificate_url: "https://tajiri.xyz/images"
 * 
 */

/**
 * @swagger
 * tags:
 *   name: UsersAPI
 *   description: The user management API
 */

/**
* @swagger
*  /users/signup:
*  post:
*    summary: Create users
*    tags: [UsersAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/signup_details'
*    responses:
*      '200':
*        description: User created successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/signup_details'
*/
router.post('/signup', userController.signup)


/**
* @swagger
*  /users/reset-password:
*  post:
*    summary: Use to reset user's password
*    tags: [UsersAPI]
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/reset_password_details'
*    responses:
*      '200':
*        description: A successful response
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/reset_password_details'
 */
// Password reset endpoints removed in simplified auth. Keep minimal endpoints below.


/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Authenticates a given user
 *     tags: [UsersAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/auth_details'
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/auth_details'
 *       401:
 *          description: Login failed
*/
router.post('/login', userController.signin)

/**
 * @swagger
 * /users/token:
 *   post:
 *     summary: Generate a new token for a given user
 *     tags: [UsersAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/token_details'
 *     responses:
 *       200:
 *         description: User logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/token_details'
 *       401:
 *          description: Aunthentication failed
 *       403:
 *          description: Access Denied
*/
router.post('/token', userController.signin)

/**
 * @swagger
 * /users/update_profile:
 *   post:
 *     summary: Update profile of a given user
 *     tags: [UsersAPI]
 *     parameters:
 *       - in: header
 *         name: authorization
 *         description: token to be passed as a header
 *         required: true
 *         schema:
 *          type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/profile_details'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/profile_details'
 *       401:
 *          description: Login failed
*/
router.get('/profile', auth.authenticateToken, userController.updateProfile)

/**
 * @swagger
 * /users/logout:
 *   delete:
 *     summary: Logs out an authenticated user
 *     tags: [UsersAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/token_details'
 *     responses:
 *       204:
 *         description: User logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               items:
 *                 $ref: '#/components/schemas/token_details'
 *       403:
 *          description: Access Denied
*/
router.delete('/logout', auth.authenticateToken, userController.logout)

module.exports = router;

// Other user-management endpoints removed for simplicity

module.exports = router;