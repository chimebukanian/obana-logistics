class ContactHelper {
    constructor(payload) {
        this.payload = payload
    }
    mapcontactFileds = (schema, obj, label = true) => {
        const fields = []
        const object = {}
        for (let item in schema) {
            if (obj[schema[item]] && label)
                fields.push({ 'label': item, 'value': obj[schema[item]] })
            if (obj[schema[item]] && !label)
                object[item] = obj[schema[item]]
        }
        return fields.length > 0 ? fields : object
    }

    contactCustomFileds = {
        'Operational Mode': 'operational_mode',
        'Instagram': 'instagram',
        'X Twitter': 'twitter',
        'Linkedin': 'linkedin',
        'Facebook': 'facebook',
        'Lead': 'lead',
        'Product Category': 'product_category',
        'Bank Name': 'bank_name',
        'Account Number': 'account_number',
        'Account Name': 'account_name',
        'Salesperson': 'sales_person_id',
        'Vendor Profile Image': 'vendor_profile_image',
        'User Type': 'type',
        'Brand of Interest': 'brand_of_interest',
        'D_O_B': 'dob',
        'Category of Interest': 'category_of_interest',
        'Customer Address': 'customer_address'
    }

    contactSchema = {
        salutation: 'salutation', first_name: 'first_name',
        last_name: 'last_name', email: 'email', phone: 'phone',
        mobile: 'phone'
    }
    billingSchema = {
        address: 'billing_address', country: 'billing_country',
        city: 'billing_city', state: 'billing_state'
    }
    addressSchema = {
        address: 'address', country: 'country',
        city: 'city', state: 'state'
    }

    getCustomerField = () => {
        return this.mapcontactFileds(this.contactCustomFileds, this.payload, true)
    }
    getContactDetails = () => {
        return this.mapcontactFileds(this.contactSchema, this.payload, false)
    }
    getBillings = () => {
        return this.mapcontactFileds(this.billingSchema, this.payload, false)
    }
    getAddres = () => {
        return this.mapcontactFileds(this.addressSchema, this.payload, false)
    }

}
module.exports = ContactHelper