const {Router} = require('express');
const walletController = require('../controllers/walletController')
const auth = require('./auth')

const router = Router();

/**
* @swagger
 * components:
 *   schemas:
 *     wallet:
 *       type: object
 *       required:
 *          - user_id
 *          - id
 *       properties:
 *         actual_balance:
 *           type: double
 *           description: Holds the withdrawable balance of an agent
 *         ledger_balance:
 *           type: double
 *           description: Holds the ledger balance of an agent
 *         lifetime_sales_value:
 *           type: double
 *           description: Holds the total value of sales made by an agent
 *         lifetime_sales_count:
 *           type: integer
 *           description: Holds the total count of sales made by an agent
 *         payout_count:
 *           type: integer
 *           description: Holds the count of the total payouts an agent made
 *         lifetime_commision:
 *           type: double
 *           description: Holds the sum of life time commissions for an agent
 *         histories:
 *           type: object
 *           description: Holds the specific wallet histories
 *       example:
 *         amount: 5464
 * 
 */

 /**
  * @swagger
  * tags:
  *   name: WalletAPI
  *   description: The wallet details API
  */

/**
* @swagger
*  /wallet:
*  get:
*    summary: Get Wallet
*    tags: [WalletAPI]
*    parameters:
*      - in: header
*        name: authorization
*        description: token to be passed as a header
*        required: true
*        schema:
*          type: string
*    responses:
*      '200':
*        description: User created successfully
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/wallet'
*/
router.get('/', auth.authenticateToken, walletController.getWallet)


/**
* @swagger
*  /wallet/payout:
*  post:
*    summary: Use to request a wallet payout
*    tags: [WalletAPI]
*    parameters:
*      - in: header
*        name: authorization
*        description: token to be passed as a header
*        required: true
*        schema:
*          type: string
*    requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/wallet'
*    responses:
*      '200':
*        description: A successful response
*        content:
*           application/json:
*             schema:
*               type: object
*               items:
*                 $ref: '#/components/schemas/wallet'
 */
router.post('/payout', auth.authenticateToken, walletController.payout)


module.exports = router;