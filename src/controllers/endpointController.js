const { check, validationResult } = require('express-validator')
const db = require('../models/db.js')
const utils = require('../../utils.js')
const userController = require('./userController')

const Endpoints = db.endpoints
const Tenants = db.tenants

/**
 * Create Endpoint
 * @param req
 * @param res
 **/
const createEndpoint = async (req, res) => {

    req.body.parameters = JSON.stringify(req.body.parameters)
    req.body.payload = JSON.stringify(req.body.payload)
    req.body.headers = JSON.stringify(req.body.headers)

    let tenant = await Tenants.findOne({ where: { name: req.body.tenant } })
    if (!tenant) {
        return res.status(400).send(
            utils.responseError('Tenant does not exist. All endpoints must be mapped to a valid tenant')
        )
    }

    delete req.body.tenant
    req.body.tenant_id = tenant.id

    const response = await Endpoints.create(req.body)

    return res.status(200).send(utils.responseSuccess(response))
}

/**
 * Update Endpoint
 * @param req
 * @param res
 **/
const updateEndpoint = async (req, res) => {
    const endpoint = await Endpoints.findOne({ where: { tenant_id: req.body.tenant_id, name: req.body.name } })
    if (!endpoint) {
        return res.status(400).send(
            utils.responseError('Tenant does not exist')
        )
    }
    const response = await Endpoints.save(req.body)

    return res.status(202).send(utils.responseSuccess(response))
}

module.exports = {
    createEndpoint,
    updateEndpoint
}