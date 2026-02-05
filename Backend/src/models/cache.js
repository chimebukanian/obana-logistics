const axios = require("axios")
const querystring = require('node:querystring');
const dbConfig = require('../config/dbConfig');


class Cache {
    constructor(redis) {
        this.redis = redis
    }
    async getZohoInvetoryToken() {
        let zohoInvetoryToken = await this.redis.get("Zoho_Invetory_Token");
        if (!zohoInvetoryToken) {
            let zohoInvetoryTokenData = (await this.refrestToken(dbConfig.inventoryRefreshTokenCredentials))?.data;

            if (zohoInvetoryTokenData?.access_token) {
                this.setCacheExValue(
                    "Zoho_Invetory_Token",
                    zohoInvetoryTokenData.expires_in - 100,
                    zohoInvetoryTokenData.access_token
                );
                zohoInvetoryToken = zohoInvetoryTokenData.access_token

            }
        }
        // console.log("zohoInvetoryTokennnn", zohoInvetoryToken)
        return 'Zoho-oauthtoken ' + zohoInvetoryToken;
    }

    async getGIGToken() {
        // Use Redis cache to avoid unnecessary logins

        let gigToken = await this.redis.get("GIGL_Token");
        if (!gigToken) {
            // GiG logistics authentication
            const axios = require('axios');
            const loginUrl = "https://dev-thirdpartynode.theagilitysystems.com/login";
            const credentials = {
                email: process.env.GIGL_USERNAME,
                password: process.env.GIGL_PASSWORD
            };
            try {
                const resp = await axios.post(loginUrl, credentials, {
                    headers: { 'Content-Type': 'application/json' }
                });

                gigToken = resp.data.data["access-token"];
                if (gigToken) {
                    this.setCacheExValue("GIGL_Token", 60, gigToken);
                }
            } catch (err) {
                throw new Error("Failed to authenticate with GiG logistics: " + (err.response?.data?.message || err.message));
            }
        }
        return `${gigToken}`;
    }


    async getZohoSalesOrderToken() {
        let zohoSalesOrderToken = await this.redis.get("Zoho_Sales_Order_Token");
        if (!zohoSalesOrderToken) {
            let zohoSalesOderTokenData = (await this.refrestToken(dbConfig.salesOrderRefreshTokenCre))?.data;
            if (zohoSalesOderTokenData?.access_token) {
                this.setCacheExValue(
                    "Zoho_Sales_Order_Token",
                    zohoSalesOderTokenData.expires_in - 100,
                    zohoSalesOderTokenData.access_token
                );
                zohoSalesOrderToken = zohoSalesOderTokenData.access_token
            }
        }
        return 'Zoho-oauthtoken ' + zohoSalesOrderToken;
    }

    async crmToken() {
        let zohoCrmToken = await this.redis.get("Zoho_Crm_Token");
        if (!zohoCrmToken) {
            let zohoCrmTokenData = (await this.refrestToken(dbConfig.crmRefreshToken))?.data;
            if (zohoCrmTokenData?.access_token) {
                this.setCacheExValue(
                    "Zoho_Crm_Token",
                    zohoCrmTokenData.expires_in - 100,
                    zohoCrmTokenData.access_token
                );
                zohoCrmToken = zohoCrmTokenData.access_token
            }
        }

        return 'Zoho-oauthtoken ' + zohoCrmToken;
    }
    async zohoBookToken() {
        let zohoBookToken = await this.redis.get("zoho_book_token");
        if (!zohoBookToken) {
            let zohoBookTokenData = (await this.refrestToken(dbConfig.zohoBookRefreshToken))?.data;
            if (zohoBookTokenData?.access_token) {
                this.setCacheExValue(
                    "zoho_book_token",
                    zohoBookTokenData.expires_in - 100,
                    zohoBookTokenData.access_token
                );
                zohoBookToken = zohoBookTokenData.access_token
            }
        }
        return 'Zoho-oauthtoken ' + zohoBookToken;
    }

    async refrestToken(refreshTokenCredentials) {
        let token = await axios.post(dbConfig.authUrl, querystring.stringify(refreshTokenCredentials))
            .catch(error => {
                console.error('Error fetching data', error);
            });

        return token
    }

    setCacheExValue(key, expiers, value) {
        this.redis.setEx(key, expiers, value);
    }

}
module.exports = Cache
