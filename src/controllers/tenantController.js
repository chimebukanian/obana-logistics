const { check, validationResult } = require('express-validator')
const db = require('../models/db.js')
const utils = require('../../utils.js')

const Tenants = db.tenants

/**
 * Create Tenant
 * @param req
 * @param res
 **/
const createTenant = async (req, res) => {

    let tenant = await Tenants.findOne({ where: { name: req.body.name } })

    if (tenant) {
        return res.status(400).send(
            utils.responseError('Tenant already exist')
        )
    }

    tenant = await Tenants.create(req.body)

    return res.status(201).send(utils.responseSuccess(tenant))
}

/**
 * Update Tenant
 * @param req
 * @param res
 **/
const updateTenant = async (req, res) => {
    let tenant = await Tenants.findOne({ where: { name: req.body.name } })
    if (!tenant) {
        return res.status(400).send(
            utils.responseError('Tenant does not exist')
        )
    }
    tenant = await Tenants.update(req.body, { where: { name: req.body.name } })

    return res.status(202).send(utils.responseSuccess(tenant))
}

module.exports = {
    createTenant,
    updateTenant
}