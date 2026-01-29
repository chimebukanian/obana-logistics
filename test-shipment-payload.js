/**
 * Sample request to test the new transport_mode and service_level fields
 * Send this to POST /api/shipments endpoint
 */

const testPayload = {
  "customer_id": "55f4880f-bf12-11f0-a7cf-0274f77d4a8",
  "user_id": "12",
  
  "vendor_name": "obana.africa",
  
  "delivery_address": {
    "first_name": "Ebuka",
    "last_name": "Anyanwu",
    "email": "Ebuka@example.com",
    "phone": "+2348069331070",
    "line1": "123 Main Street",
    "line2": "Suite 45",
    "city": "Lagos",
    "state": "Lagos",
    "country": "NG",
    "zip": "100001",
    "is_residential": true,
    "instructions": "Call before delivery",
    "metadata": {
      "customer_notes": "Please deliver between 2-4 PM"
    }
  },
  
  "pickup_address": {
    "contact_name": "Warehouse Manager",
    "phone": "+2348163957185",
    "email": "iconwarehouse@techgadgets.com",
    "line1": "77 Opebi Road",
    "city": "Ikeja",
    "state": "Lagos",
    "country": "NG",
    "zip": "100242",
    "instructions": "Pickup at loading bay",
    "metadata": {
      "vendor_id": "VENDOR-TECH-001"
    }
  },
  
  "items": [
    {
      "item_id": "ITEM-001",
      "name": "Wireless Bluetooth Headphones",
      "description": "Noise cancelling headphones with mic",
      "quantity": 2,
      "price": 15000.00,
      "total_price": 30000.00,
      "weight": 0.5,
      "currency": "NGN",
      "dimensions": {
        "length": 20,
        "width": 15,
        "height": 10
      }
    },
    {
      "item_id": "ITEM-002",
      "name": "Smart Watch Series 5",
      "description": "Waterproof smart watch with GPS",
      "quantity": 1,
      "price": 45000.00,
      "total_price": 45000.00,
      "weight": 0.3,
      "currency": "NGN",
      "dimensions": {
        "length": 10,
        "width": 8,
        "height": 5
      }
    }
  ],
  
  "amount": 75000.00,
  "shipping_fee": 2500.00,
  "currency": {
    "symbol": "NGN",
    "rate": 1
  },
  
  // NEW FIELDS - Transport mode and service level
  "transport_mode": "road",        // Options: "road", "air", "sea"
  "service_level": "Standard",     // Options: "Express", "Standard", "Economy"
  
  "carrier_slug": "obana",
  "carrier_name": "Obana Logistics",
  
  "is_insured": true,
  "insurance_amount": 5000.00,
  
  "notes": "Fragile items, handle with care",
  
  "dispatcher": {
    "carrier_name": "Obana Logistics",
    "carrier_slug": "obana",
    "carrier_logo": "https://obana.com/logo.png",
    "metadata": {
      "address_payload": {
        "pickup_address": {
          "line1": "77 Opebi Road",
          "city": "Ikeja",
          "state": "Lagos",
          "country": "NG",
          "zip": "100242"
        }
      },
      "default_parcel": {
        "parcel_total_weight": 0.8,
        "parcel_value": 75000.00
      }
    }
  }
};

module.exports = testPayload;
