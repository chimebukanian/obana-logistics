const utils = require('../../utils')
const { EventstHelper } = require('../helpers/eventsHelper')
const { WeebHooksHelper } = require('../helpers/webHooksHelper')
const { sendRequest } = require('../helpers/sendRequestHelper')
const { validateRequest, getTenantAndEndpoint } = require('../helpers/requestValidator')
const { sampleRequestHelper } = require('../helpers/sampleRequestHelper')


/**
 * Make request api call
 * @param req
 * @param res
 **/
const makeRequest = async (req, res) => {
    
    const { tenant, endpoint, msg } = await getTenantAndEndpoint(req.params, res)
    // console.log("TENANT AND ENDPOINT", tenant, endpoint, msg)
    if (msg)
        return res.status(400).send(
            utils.responseError(msg)
        )
    let requestDetails = await validateRequest({ tenant, endpoint, req, res })
    // {
    //     route
    //     headers
    //     query
    //     payload
    //     user
    //      req, 
    //      res,
    //     requestHelper
    // }

    try {
        const requestHelper = requestDetails.requestHelper

        requestDetails = await handleEvent(requestDetails, endpoint, "before_execute")
        if (requestDetails.exit) return exitRequest(requestDetails, res)

        const rawResponse = await sendRequest(requestDetails)
        requestDetails.response = rawResponse.data


        utils.setParameters({ response: JSON.parse(requestDetails.response) }, requestHelper)
        requestDetails = await handleEvent(requestDetails, endpoint, "after_execute")

        const response = await requestHelper.getResponse()
        if (requestDetails.exit) return exitRequest(requestDetails, res)
        if (requestDetails.payload?.return || req.body?.return)
            return response
        return res.status(200).send(utils.responseSuccess(response))

    } catch (err) {
        if (requestDetails.payload.return || req.body.return)
            return err.message
        if (err.message)
            return res.status(500).send(utils.responseError(err.message));
        return
    }
}

const exitRequest = async (requestDetails, res) => {
    if (!requestDetails?.response?.statusCode) return
    if (requestDetails?.response?.statusCode !== 200) {
        return requestDetails.payload.return ? requestDetails?.response : res.status(requestDetails?.response?.statusCode ?? 500).
            send(utils.responseError(requestDetails?.response?.data ?? "Somthing went wrong", requestDetails?.response?.statusCode ?? 500))
    } else return requestDetails.payload.return ? requestDetails?.response : res.status(200).send(utils.responseSuccess(requestDetails.response.data))
}


const webHooks = async (req, res) => {
    let endpoint = req.params?.endpoint
    if (!endpoint) return res.status(401).send()
    new WeebHooksHelper(endpoint, req, res, makeRequest).callMethods()
}

/**
 * A function to Pull order back from zoho manually.
 */
const syncZohoOrder = async (req, res) => {
    req.body.return = 1
    req.params = { endpoint: 'get-orderdetail', tenant: 'zoho' }
    const resp = await makeRequest(req, res)
    if (!resp.salesorder)
        return res.status(400).send({ message: "No order found" })
    req.body = resp
    return await new WeebHooksHelper('webHooks', req, res, makeRequest).callMethods()
}

/**
 * A function to recieve an event and prepares it for execution
 */
const handleEvent = async (requestDetails, endpoint, eventType) => {
    if (endpoint[eventType]) {
        const eventDetails = JSON.parse(endpoint[eventType])
        if (eventDetails.shouldWait) {
            const eventResponse = await emitEvent(requestDetails, eventType)
            if (eventDetails.assignTo) {

                requestDetails = await utils.changeVal(requestDetails, eventDetails.assignTo, eventResponse)
                utils.setParameters({ [eventDetails.assignTo]: eventResponse }, requestDetails.requestHelper)
                // console.log("EVENT RESPONSE", eventResponse, requestDetails.requestHelper)
                // '{ "Content-Type": "application/json",  "Authorization":"eventresponse", requestDetails.requestHelper.headers.Authorization = eventResponse}'
            }
        } else {
            emitEvent(requestDetails, eventType)
        }
    }
    return requestDetails
}


/**
 * An event based function to execute any require calls before the actual call
 */
const emitEvent = async (requestDetails, eventType) => {
    const eventsHelper = new EventstHelper(requestDetails)
    const eventDetails = JSON.parse(requestDetails.endpoint[eventType])

    if (eventDetails.shouldWait)
        return await eventsHelper[eventDetails.method]()

    eventsHelper[eventDetails.method]()
}


/**
 * Method to get wish produven
 * @param {object} payload
 **/
const constructAndMakeRequest = async (payload) => {
    if (!(payload.tenant && payload.endpoint))
        return "Invalid request. You must specify a tenant and endpoint in your request"
    payload.req.query.attribute = payload.attribute
    payload.req.query.condition = payload.condition
    payload.req.query.value = payload.value
    payload.req.params.tenant = payload.tenant
    payload.req.params.endpoint = payload.endpoint
    payload.req.body.return = true

    return await makeRequest(payload.req, payload.res)
}


module.exports = {
    makeRequest,
    constructAndMakeRequest,
    webHooks,
    syncZohoOrder
}
