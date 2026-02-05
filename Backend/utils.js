//This is the utility file
const responseError = (message, code = null) => {
  return {
    status: 'error',
    code: code,
    message: message
  }
}

const responseSuccess = (data) => {
  return {
    status: 'success',
    data: data
  }
}

const isEmail = (email) => {
  var re = /\S+@\S+\.\S+/;
  return re.test(email);
}


const setParameters = (parameters, caller) => {
  Object.entries(parameters).map(([key, value]) => {
    caller[key] = value;
  });
  // explain practically how the above works with an example
  // Objecr.entries({["a"]: "b"}) => [["a", "b"]]
  // [["a", "b"]].map(([key, value]) => { caller[key] = value })
  // caller['a'] = 'b'

  //Object.entries({a:1, b:2}) => [['a', 1], ['b', 2]]
  // [['a', 1], ['b', 2]].map(([key, value]) => { caller[key] = value })
  // caller['a'] = 1
  // caller['b'] = 2

  return caller;

};

const getOrderDetailTotalAmount = (order) => {
  const order_details = JSON.parse(order.order_details)
  let total = 0
  for (let item of order_details) {
    total += item.rate * item.quantity
  }
  return Number(total).toFixed(2)
}

// getVal(ref, caller, method = null){
//     if(method)
//         return caller.eval[method(ref)];

//     return caller.ref
// }


/**
* Change value of property of an object recursively
* @param target - object
* @param needle - string representing object (eg; endpoints.ssop.optional)
* @param value
* @return target
*/
const changeVal = async (target, needle, value) => {
  const parts = needle.toString().split('.');
  const newNeedle = parts;
  if (parts.length > 1) {
    const newObj = await target[parts[0]];
    newNeedle.shift();
    await changeVal(newObj, newNeedle.join('.'), value);
  } else {
    target[parts[0]] = value;
  }
  return target;
}


/**
* Get value of a property of an object recursively
* @param data - object
* @param needle - string representing object 
* eg:
*   1. endpoints.ssop.optional
*   2. custom_attributes.['attribute_code','image','value'] 
*    - First item in the array is the search criteria,
*    - Second is the match value
*    - Third is the key to be return. Where not available, returns the entire object
* @return val string
*/
const getVal = async (data, needle) => {
  const parts = needle.toString().split('.');
  let temp_data = JSON.parse(JSON.stringify(data));
  await parts.forEach(async (e) => {
    const pattern = /\[[',"{}:a-zA-Z_-]*\]/g;
    if (e.match(pattern)) {
      temp_data = await getArrayVal(temp_data, e);
    } else {
      temp_data = temp_data[e];
    }
  });
  return temp_data;
}

/**
* Get value from array of objects 
* @param {*} arr - Array
* @param {*} target - Array
*  Eg: ['attribute_code','image','value']
*    - First item in the array is the search criteria,
*    - Second is the match value
*    - Third is the key to be return. Where not available, returns the entire object
* @returns val
*/
const getArrayVal = async (arr, target) => {
  target = target.match(/(\{.*\})|([a-zA-Z_-]+)/g)
  let data = arr.filter((item) => {
    return item[target[0]] == target[1];
  })
  if (target[2]) {
    if (data.length === 1) {
      data = data[0][target[2]];
    } else {
      const temp = [];
      await data.forEach((item) => {
        temp.push(item[[2]]);
      })
      data = temp;
    }
  }
  return data;
}

const generateRandomString = (length) => {
  return Math.random().toString(36).substr(2, length);
}

const genCuponCode = () => {
  return `${temPassword()}${Date.now()}`
}

function temPassword() {
  const arr = "ABCDEFGHIJK$£$*&@LMNOPQRSTUVWXYZabcdefgh12345678ijklmnopqrstuvwxyz1234567890!$£$*&@"
  let ans = '';
  for (let i = 10; i > 0; i--) {
    ans +=
      arr[(Math.floor(Math.random() * arr.length))];
  }
  return ans;
}

const scopeMiddleware = (allowScope) => {
  return (req, res, next) => {
    if (!req?.user?.permission?.scope.includes(allowScope)) {
      return res.status(403).json({ "message": `Access denied. Youd need ${allowScope} scope to access this resources` })
    }
    next()
  }
}


const zohoHerders = (token, form = null) => {
  return {
    'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
    'Authorization': token
  }
}

const validateAndCleanObject = (obj, allowedKeys) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => allowedKeys.includes(key))
  );
}
const default7DaysInterval = () => {
  let endDate = (new Date().toISOString()).split("T")[0];
  let startDate = (new Date(new Date().setDate(new Date().getDate() - 6))).toISOString().split("T")[0];
  return { startDate, endDate }
}

const flattenObj = (ob) => {
  let result = {};
  for (const i in ob) {
    if ((typeof ob[i]) === 'object' && !Array.isArray(ob[i])) {
      const temp = flattenObj(ob[i]);
      for (const j in temp) {
        result[j] = temp[j];
      }
    }
    else {
      result[i] = ob[i];
    }
  }
  return result;
};



/**
 * Format items for Terminal Africa shipment parcel
 * Used when creating shipments via Terminal Africa API
 * @param {Array} items - Cart items
 * @returns {Array} Formatted items for Terminal Africa
 */
const formartShipment = (items) => {

  return items.map(item => {
    // Ensure weight is a number, not empty string
    const weight = parseFloat(item.weight) || 1;

    // Ensure value is a number
    const value = parseFloat(item.value) || parseFloat(item.total_price) || 0;

    const formattedItem = {
      description: item.description || item.name,
      name: item.name,
      currency: item.currency || "NGN",
      value: value,
      quantity: item.quantity || 1,
      weight: weight
    };

    return formattedItem;
  });
};

/**
 * FIXED: Format shipment details by delivery type - HANDLE MISSING PICKUP ADDRESSES
 */
const formatShipmentByDeliveryType = (cartItems, payload) => {
  const deliveryType = payload.delivery_type;
  const isMultiVendor = payload.isMultiVendor;



  // CASE 1: PER-VENDOR SELECTION
  if (deliveryType === 'per-vendor' && payload.vendor_selections) {
    console.log(` Processing PER-VENDOR with ${payload.vendor_selections.length} selections`);

    return payload.vendor_selections.map(selection => ({
      vendor_id: selection.vendor_id,
      pickup_address: selection.pickup_address,
      rate_id: selection.rate_id,
      carrier_reference: selection.carrier_reference,
      items: selection.items.map(item => ({
        ...item,
        
        weight: parseFloat(item.weight) || 1,
        value: parseFloat(item.value) || 0
      })),
      cost: selection.cost
    }));
  }

  // CASE 2: AGGREGATED MULTI-VENDOR
  else if (deliveryType === 'aggregated' && isMultiVendor && payload.vendor_groups) {
    console.log(` Processing AGGREGATED with ${payload.vendor_groups.length} vendor groups`);

    return payload.vendor_groups.map(group => ({
      vendor_id: group.vendor_id,
      pickup_address: group.pickup_address,
      rate_id: group.vendor_rate_id,
      carrier_reference: payload.carrier_reference,
      items: group.items.map(item => ({
        ...item,
        
        weight: parseFloat(item.weight) || 1,
        value: parseFloat(item.value) || 0
      }))
    }));
  }

  // CASE 3: SINGLE VENDOR
  else {
    console.log(` Processing SINGLE VENDOR (traditional flow)`);

    
    const vendorGroups = groupItemsByVendor(cartItems);

    
    if (vendorGroups.length > 0) {
      const firstVendorGroup = vendorGroups[0];

      return [{
        vendor_id: firstVendorGroup.vendor_id,
        pickup_address: firstVendorGroup.pickup_address,
        rate_id: payload.rate_id,
        carrier_reference: payload.carrier_reference,
        items: firstVendorGroup.items.map(item => ({
          ...item,
          // Ensure weight and value are numbers
          weight: parseFloat(item.weight) || 1,
          value: parseFloat(item.value) || 0
        }))
      }];
    } else {

      // Use default pickup address when no pickup address is provided
      const defaultPickupAddress = getDefaultPickupAddress();

      return [{
        vendor_id: 'vendor_1',
        pickup_address: defaultPickupAddress,
        rate_id: payload.rate_id,
        carrier_reference: payload.carrier_reference,
        items: cartItems.map(item => ({
          item_id: item.item_id,
          name: item.name,
          description: item.description || item.name,
          currency: item.currency || "NGN",
          value: parseFloat(item.value) || parseFloat(item.total_price) || 0,
          quantity: item.quantity || 1,
          weight: parseFloat(item.weight) || 1
        }))
      }];
    }
  }
};

/**
 * Get default pickup address (fallback) - ENHANCED
 */
const getDefaultPickupAddress = () => {
  return {
    first_name: "Obana",
    last_name: "Africa",
    email: "support@obana.com",
    phone: "+2348090335245",
    is_residential: false,
    line1: "77 Opebi Road",
    line2: "Ikeja",
    city: "Ikeja",
    state: "Lagos",
    country: "NG",
    zip: "100001"
  };
};

/**
 * FIXED: Group items by vendor/pickup address - HANDLE MISSING PICKUP ADDRESSES
 */
const groupItemsByVendor = (cartItems) => {
  const vendorMap = {};

  cartItems.forEach(item => {
    // Check if item has pickup_address, if not use default
    let pickupAddress = item.pickup_address;

    if (!pickupAddress) {
      console.warn(`⚠️ Item ${item.name} has no pickup_address, using default`);
      pickupAddress = getDefaultPickupAddress();
    }

    // Create unique key from pickup address
    const pickupKey = JSON.stringify({
      line1: pickupAddress?.line1?.trim().toLowerCase() || '',
      city: pickupAddress?.city?.trim().toLowerCase() || '',
      state: pickupAddress?.state?.trim().toLowerCase() || '',
      country: pickupAddress?.country?.trim().toUpperCase() || ''
    });

    if (!vendorMap[pickupKey]) {
      vendorMap[pickupKey] = {
        vendor_id: `vendor_${Object.keys(vendorMap).length + 1}`,
        pickup_address: pickupAddress, // Use the pickup address (could be default)
        items: []
      };
    }

    // Add item without pickup_address (already at group level)
    const { pickup_address, ...itemWithoutAddress } = item;
    vendorMap[pickupKey].items.push({
      ...itemWithoutAddress,
      item_id: item.item_id,
      name: item.name,
      description: item.description || item.name,
      currency: item.currency || "NGN",
      value: item.value || item.total_price || 0,
      quantity: item.quantity || 1,
      weight: item.weight || 1
    });
  });

  const groups = Object.values(vendorMap);
  console.log(` Grouped ${cartItems.length} items into ${groups.length} vendor groups`);
  groups.forEach((group, index) => {
    console.log(`   Group ${index}: ${group.items.length} items from ${group.pickup_address?.line1}, ${group.pickup_address?.city}`);
  });

  return groups;
};

const isStaging = () => {
  return process.env.NODE_ENV !== 'production' ? true : false
}

module.exports = {
  responseError,
  responseSuccess,
  isEmail,
  changeVal,
  getVal,
  setParameters,
  generateRandomString,
  zohoHerders,
  scopeMiddleware,
  validateAndCleanObject,
  default7DaysInterval,
  temPassword,
  flattenObj,
  genCuponCode,
  formatShipmentByDeliveryType,
  formartShipment,
  isStaging,
  getOrderDetailTotalAmount,
  getOrderDetailTotalAmount,
}
