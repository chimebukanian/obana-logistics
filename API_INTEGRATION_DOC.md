# Obana API — Frontend Integration Guide

This document describes how to integrate the frontend with the Obana API: auth (OTP flow), route template matching, and shipment creation. Use the sample payloads and curl/JS examples to implement and test the flows.

Base URL
- Default (dev): http://localhost:3006

Quick overview
- Auth uses an OTP-backed flow: request (signup/login) -> verify OTP -> receive auth details (access + refresh tokens).
- Route templates let the frontend request a price/ETA preview by comparing a shipment draft to seeded templates via `/routes/match`.
- When user proceeds, frontend sends the full shipment create request to `/shipments`, including `shipping_fee` and optional `estimated_delivery` from match result.

1. Authentication

1.1 Signup (request OTP)
- POST /users/signup
- Body:

```json
{
  "email": "user@example.com",
  "phone": "+2348012345678",
  "password": "Password@1",
  "role": "customer"
}
```

Response: success message; server creates a verification record and sends OTP. Then call `/verify/otp`.

1.2 Login (request OTP)
- POST /users/login
- Body:

```json
{ "user_identification": "user@example.com", "password": "Password@1" }
```

Response: success and OTP sent (dev: OTP visible via GET /verify/otp?email=...)

1.3 Verify OTP
- POST /verify/otp
- Body:

```json
{ "request_id": "<request_id>", "otp": "1234" }
```

On success returns authenticated user and tokens (access_token, refresh_token). Save tokens in secure storage on frontend.

1.4 Token refresh
- POST /users/token
- Body: `{ "refresh_token": "<refresh_token>" }`
- Response: `{ "access_token": "<new_access_token>" }`

1.5 Logout
- DELETE /users/logout (requires `Authorization: Bearer <access_token>` header)
- Body: `{ "refresh_token": "<refresh_token>" }`

Headers for protected requests
- `Authorization: Bearer <access_token>`

2. Route Templates (Routes Management)

2.1 Seeded templates (for testing)
- Ikeja → Ibadan (road, Standard):
  - 0–1kg: price 800, eta "1-2 days"
  - 1.01–5kg: price 1200, eta "1-2 days"
  - 5.01–20kg: price 2500, eta "2-3 days"
- Lagos → Abuja (air, Express):
  - 0–1kg: 2500, eta "Same day"
  - 1.01–5kg: 4000, eta "1 day"
- Lagos → London (air, International Express):
  - 0–1kg: 20000, eta "2-3 days"
  - 1.01–5kg: 50000, eta "3-5 days"

2.2 List templates
- GET /routes

2.3 Get a template
- GET /routes/:id

2.4 Create a template (admin/testing)
- POST /routes
- Body example:

```json
{
  "origin_city":"Ikeja",
  "destination_city":"Ibadan",
  "transport_mode":"road",
  "service_level":"Standard",
  "weight_brackets":[
    {"min":0,"max":1,"price":800,"eta":"1-2 days"},
    {"min":1.01,"max":5,"price":1200,"eta":"1-2 days"}
  ],
  "metadata": {"notes":"test"}
}
```

2.5 Update template
- PUT /routes/:id (body same shape as create)

2.6 Delete template
- DELETE /routes/:id

2.7 Match template (price & ETA preview)
- POST /routes/match
- Required body:

```json
{
  "origin_city":"Ikeja",
  "destination_city":"Ibadan",
  "transport_mode":"road",
  "service_level":"Standard",
  "weight":0.8
}
```

- Successful response: `{ "template": {...}, "match": {"min":..,"max":..,"price":..,"eta":"..."} }`
- Not found: 404 with message.

3. Shipment creation flow

3.1 Frontend flow
1. User fills draft form: origin, destination, transport_mode, service_level, weight.
2. Call `POST /routes/match` with draft — show `price` & `eta` to user.
3. If user proceeds, include `shipping_fee` (price) and optional `estimated_delivery` (eta) in the shipment create payload and call `POST /shipments`.

3.2 Create shipment endpoint
- POST /shipments (requires validation and usually protected)
- Required highlights:
  - `customer_id`, `delivery_address` (line1, city, state, country, phone), `items` (with weights), `transport_mode`, `service_level`.

3.3 Sample shipment payload (use matched price/eta)

```json
{
  "customer_id":"55f4880f-bf12-11f0-a7cf-0274f77d4a8",
  "user_id":"12",
  "vendor_name":"obana.africa",
  "delivery_address":{ "first_name":"Ebuka", "line1":"123 Main St","city":"Ibadan","state":"Oyo","country":"NG","phone":"+2348069331070" },
  "pickup_address":{ "line1":"77 Opebi Road","city":"Ikeja","state":"Lagos","country":"NG","phone":"+2348163957185" },
  "items":[{"item_id":"ITEM-001","name":"Widget","quantity":1,"total_price":15000,"weight":0.8}],
  "amount":15000,
  "shipping_fee":800,
  "estimated_delivery":"1-2 days",
  "currency":{"symbol":"NGN","rate":1},
  "transport_mode":"road",
  "service_level":"Standard",
  "carrier_slug":"obana",
  "carrier_name":"Obana Logistics"
}
```

4. Examples (curl & JS)

4.1 Match example (curl)

```bash
curl -X POST http://localhost:3006/routes/match \
  -H "Content-Type: application/json" \
  -d '{"origin_city":"Ikeja","destination_city":"Ibadan","transport_mode":"road","service_level":"Standard","weight":0.8}'
```

4.2 Create shipment (curl)

```bash
curl -X POST http://localhost:3006/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '<SHIPMENT_PAYLOAD_JSON>'
```

