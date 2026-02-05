const db = require('../models/db.js')
const utils = require('../../utils')
const { RequestHelper } = require('./requestHelper')

/**
 * Use validator class to map and validate tenant requirements against available resources
 * Resources here means headers, payload, param
 * @param payload
 */
const validateRequest = async (payload) => {
    const requestHelper = new RequestHelper(payload.endpoint, payload.tenant)
    utils.setParameters(
        {
            query: payload.req.query,
            payload: payload.req.body,
            headers: payload.req.headers
        },
        requestHelper
    );

    return {
        route: await requestHelper.getRoute(),
        headers: await requestHelper.getHeaders(),
        query: await requestHelper.getQuery(),
        payload: await requestHelper.getPayload(),
        user: payload.req.user ?? "",
        ...payload,
        requestHelper
    }
}


/**
 * Funtion to retrive tenant and endpoint
 * @param requestParams
 * @return {object} tenant and endpoint
 */
const getTenantAndEndpoint = async (requestParams, res) => {
    const tenant = await db.tenants.findOne({ where: { slug: requestParams.tenant } })
    let msg = null
    if (!tenant)
        return { tenant, endpoint: null, msg: 'Tenant does not exist' }

    const endpoint = await db.endpoints.findOne({
        where: { slug: requestParams.endpoint, tenant_id: tenant.id }
    })
    if (!endpoint)
        msg = 'Endpoint does not exist'

    return { tenant, endpoint, msg }

}

module.exports = {
    validateRequest,
    getTenantAndEndpoint
}