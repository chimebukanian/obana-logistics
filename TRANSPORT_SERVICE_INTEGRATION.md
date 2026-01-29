# Transport Mode & Service Level Integration

## Overview
The shipment system now supports specifying the transport mode and service level for each shipment. These fields allow customers to choose how their packages are delivered and at what speed.

## New Fields Added

### 1. `transport_mode` (Required)
- **Type**: ENUM
- **Allowed Values**: `road`, `air`, `sea`
- **Default**: `road`
- **Description**: Specifies the transportation method for the shipment
- **Use Cases**:
  - `road`: Ground delivery via vehicle (bike, car, van, truck)
  - `air`: Air freight for urgent/long-distance shipments
  - `sea`: Maritime shipping for bulk/international shipments

### 2. `service_level` (Required)
- **Type**: ENUM
- **Allowed Values**: `Express`, `Standard`, `Economy`
- **Default**: `Standard`
- **Description**: Specifies the service tier/delivery speed
- **Use Cases**:
  - `Express`: 4-6 hour delivery, premium pricing
  - `Standard`: 24-48 hour delivery, standard pricing
  - `Economy`: 3-5 day delivery, budget pricing

## Database Changes

### Migration File
- **File**: `src/migrations/20260129-add-transport-service-fields.js`
- **Changes**:
  - Added `transport_mode` ENUM column to `shippings` table
  - Added `service_level` ENUM column to `shippings` table
  - Both columns include appropriate PostgreSQL ENUM types

### Model Updates
- **File**: `src/models/shipmentsModel.js`
- **Changes**:
  - Added `transport_mode` field definition
  - Added `service_level` field definition

## Controller Updates

### Validation
- **File**: `src/controllers/shipmentsController.js`
- **Function**: `validateShipmentPayload()`
- **Changes**:
  - Added validation for `transport_mode` (required, must be one of: road, air, sea)
  - Added validation for `service_level` (required, must be one of: Express, Standard, Economy)
  - Returns descriptive error messages if validation fails

### Shipment Creation
- **File**: `src/controllers/shipmentsController.js`
- **Function**: `createShipment()`
- **Changes**:
  - Extracts `transport_mode` and `service_level` from request payload
  - Stores them in the shipment record
  - Falls back to defaults if not provided (transport_mode: 'road', service_level: 'Standard')

## API Request Example

```json
{
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
    "instructions": "Call before delivery"
  },
  
  "pickup_address": {
    "contact_name": "Warehouse Manager",
    "phone": "+2348163957185",
    "email": "iconwarehouse@techgadgets.com",
    "line1": "77 Opebi Road",
    "city": "Ikeja",
    "state": "Lagos",
    "country": "NG",
    "zip": "100242"
  },
  
  "items": [
    {
      "item_id": "ITEM-001",
      "name": "Wireless Bluetooth Headphones",
      "quantity": 2,
      "price": 15000.00,
      "total_price": 30000.00,
      "weight": 0.5
    }
  ],
  
  "amount": 75000.00,
  "shipping_fee": 2500.00,
  "currency": { "symbol": "NGN", "rate": 1 },
  
  "transport_mode": "road",
  "service_level": "Express",
  
  "carrier_slug": "obana",
  "carrier_name": "Obana Logistics",
  
  "is_insured": true,
  "insurance_amount": 5000.00,
  "notes": "Fragile items, handle with care"
}
```

## Error Handling

When validation fails, the API returns:

```json
{
  "success": false,
  "message": "Invalid payload",
  "errors": [
    "transport_mode is required (road, air, or sea)",
    "service_level is required (Express, Standard, or Economy)"
  ]
}
```

## Database Seeder

### Drivers Seeder
- **File**: `seeders/20260129-demo-drivers.js`
- **Content**: Two test drivers seeded for testing shipment assignments
- **Drivers**:
  1. **OBANA-DRV-001**: Car driver with 45 deliveries (98% success rate)
  2. **OBANA-DRV-002**: Bike driver with 128 deliveries (98% success rate)

### Running the Seeder
```bash
npx sequelize-cli db:seed:all
```

## Future Enhancements

1. **Pricing Rules**: Define different rates based on transport_mode × service_level combinations
2. **Availability Checks**: Validate if selected mode/level is available for the route
3. **Filtering**: Add filters to shipment queries by transport_mode and service_level
4. **Analytics**: Track metrics by transport mode and service level
5. **Notifications**: Send different notifications based on service level
6. **SLA Tracking**: Define and monitor SLAs per service level

## Testing

A sample test payload is provided in `test-shipment-payload.js` that includes both new fields with valid values.

To test the API:
1. Ensure the application is running: `node app.js`
2. Send a POST request to `/api/shipments` with the sample payload
3. Verify the response includes the transport_mode and service_level fields
