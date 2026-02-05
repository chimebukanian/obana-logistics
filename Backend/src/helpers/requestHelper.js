const utils = require('../../utils.js')

const PARAM_TEXT = "parameters";
const HEADER_TEXT = "headers";
const PAYLOAD_TEXT = "payload";
const ROUTE_TEXT = "route";
const GRAPHQL_TEXT = "graph";
const SOAP_TEXT = "soap";
const REST_TEXT = "rest";
const RESPONSE_TEXT = "response";
const STRING = "string";
const OBJECT = "object";
const REPLACE = "replace";
const APPEND = "append";
const PREPEND = "prepend";

class RequestHelper {

    endpoint;
    tenantConfig;
    query;
    payload;
    headers;
    response;
    errors;

    constructor(endpoint, tenant) {
        this.endpoint = endpoint;
        this.tenantConfig = tenant?.config ? JSON.parse(tenant?.config) : {};
        this.errors = {};
    }

    /**
     * @return param
     */
    getQuery = () => {
        return this.mapper(OBJECT, PARAM_TEXT);
    };

    /**
     * @return payload
     */
    getPayload = () => {
        const type = this.endpoint.type == REST_TEXT ? OBJECT : STRING;
        return this.mapper(type, PAYLOAD_TEXT);
    };

    /**
     * @return headers
     */
    getHeaders = () => {
        return this.mapper(OBJECT, HEADER_TEXT);
    };

    /**
     * @return properly formatted route
     */
    getRoute = () => {
        return this.mapper(STRING, ROUTE_TEXT);
    };

    /**
     * @return properly formatted response based on provided response format
     */
    getResponse = () => {
        return this.mapper(OBJECT, RESPONSE_TEXT);
    };

    /**
     * Maps available resources to tenant required resources
     * Resources here refers to headers, payload, param, route, graph QL query etc
     * @param type
     */
    mapper = (type, source) => {
        try {
            const dataSource = this.endpoint[source];
            if (!dataSource) return this[source];
            switch (type) {
                case STRING:
                    const pattern = /#([^#]+)#/g;
                    const result = dataSource.replace(
                        pattern,
                        (e) => this.mapperStringVal(e)
                    );
                    return this.endpoint.type == GRAPHQL_TEXT ? { query: result } : result;
                default:
                    return this.mapperObjectVal(dataSource, source)
            }
        } catch (e) {
            throw (e.message);
        }
    };

    /**
     * Map values for string components
     * @param {*} e -Eg #{source: payload.cart_id, default: 1, validations: {required: 1, length: 6}}#
     * @returns 
     */
    mapperStringVal = (e) => {
        const parts = JSON.parse(e.replace(/^\#?|\#?$/g, ""));
        const sourceData = parts.source.split('.')
        const source = this[sourceData[0]];
        /**
         * TODO - Implement validations and throw error when it fails
         */
        const key = sourceData[1];
        const validations = parts.validations;
        const defaultVal = parts.default;
        const value = source[key] ? source[key] : '';
        return !value && defaultVal ? defaultVal : value;
    }

    /**
     * Map values for object components
     * @param {*} source 
     * @returns 
     */
    mapperObjectVal = async (dataSource, source) => {

        const db_elems = dataSource ? JSON.parse(dataSource) : {};

        let items = null;
        if (source == RESPONSE_TEXT && db_elems['items']) {
            const itemsKey = db_elems.items.key;
            const itemsSource = db_elems.items.value;
            delete db_elems.items;

            items = [];
            const values = this[source][itemsKey];

            items = await Promise.all(values.map(async (value) => {
                return await this.objectVal(itemsSource, value);
            }))
        }
        const result = await this.objectVal(db_elems);
        if (items) result.items = items;
        return result;
    }


    objectVal = async (db_elems, valueFrom = this) => {
        const temp_params = JSON.parse(JSON.stringify(db_elems));
        await Promise.all(Object.entries(db_elems).map(async ([key, value]) => {
            /**
             * TODO - Implement validations and throw error when it fails
             */
            const validations = value?.validations ?? '';
            const target = value?.source ?? '';
            const reset = value?.reset ?? '';
            const defaultVal = value?.default ?? '';
            let temp_val;
            if (target) {
                temp_val = await utils.getVal(valueFrom, target.toString());
                if (temp_val && temp_val !== 'null') {
                    temp_params[key] = temp_val;
                } else {
                    delete temp_params[key];
                }
            }

            if (reset) {
                temp_params[key] = await this.resetVal(temp_val, reset.source, reset.type);
            }

            if (!temp_params[key] && defaultVal) {
                temp_params[key] = defaultVal;
            }

        }));
        return temp_params;
    }

    resetVal = async (value, target, type = REPLACE, valueFrom = this) => {
        const resetVal = await utils.getVal(valueFrom, target.toString());
        switch (type) {
            case PREPEND:
                value = resetVal + value;
                break;
            case APPEND:
                temp_params[key] += resetVal;
                break;
            default:
                temp_params[key] = resetVal;

        }
        return value;
    }

}

module.exports.RequestHelper = RequestHelper