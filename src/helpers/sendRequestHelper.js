const { Axios } = require('axios');
const db = require('../models/db.js')

const sendRequest = async (requestDetails) => {

    const log = requestDetails.endpoint.log ? await logRequest(requestDetails) : null

    try {
        const scheme = requestDetails.endpoint.scheme ?? "https://"
        const AxiosInstance = new Axios({
            baseURL: `${scheme}${requestDetails.tenant.base_url}`,
            headers: requestDetails.headers,
            params: requestDetails.query,
        })
        const httpResponse = await AxiosInstance.request({
            url: `/${requestDetails.route}`,
            data: JSON.stringify(requestDetails.payload),
            method: requestDetails.endpoint.verb,
            headers: {
                "Content-Type": "application/json",
                // "Accept": "application/json"
            }
        })
        log ? log.response = JSON.stringify(httpResponse.data ?? {}) : null
        log ? log.save() : null

        return httpResponse
    } catch (err) {
        log ? log.response = JSON.stringify(err?.response?.data ?? {}) : null
        log ? log.save() : null
        return err
    }
}

const logRequest = async (requestDetails) => {
    return await db.requests.create({
        destination_route: `${requestDetails.tenant.base_url}/${requestDetails.route}`,
        originating_route: requestDetails.req.get('Origin') ?? 'same',
        payload: JSON.stringify(requestDetails.payload)
    })
}
module.exports = {
    sendRequest,
}
