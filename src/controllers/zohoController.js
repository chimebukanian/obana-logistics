const db = require('../models/db.js')
const utils = require("../../utils.js")
const axios = require("axios")
const dbConfig = require('../config/dbConfig.js');
const querystring = require('node:querystring');
const userControler = require("../controllers/userController.js")



const updateZohoProductImage = async (req, res) => {

    let query = querystring.stringify({ 'organization_id': dbConfig.orgId })
    let token = await db.cache.getZohoInvetoryToken()
    let headers = utils.zohoHerders(token)

    let imageUrl = req.body.imageUrl
    let productId = req.body.productId
    if (!imageUrl || !productId) throw Error('Image url is mission')

    let url = `${dbConfig.zohoBaseUrl}items/${productId}?${query}`
    let payload = { "custom_fields": [{ "label": "ProductImages", "value": `${imageUrl}` }] }

    try {
        let zohoProducts = await axios.put(url, payload, { headers: headers })
        return res.status(200).send(utils.responseSuccess(zohoProducts?.data))
    } catch (error) {
        console.log(error)
        return res.status(400).send(utils.responseError(error.message))
    }
}




module.exports = {
    updateZohoProductImage
}

