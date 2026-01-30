# 🔐 Simplified Authentication System

## Overview

The authentication system now supports 3 roles with a clean, unified approach:
- **Admin**: Full system access
- **Driver**: Driver-specific functionality + shipment assignment
- **Customer**: Standard user for placing orders

---

## Architecture

### Database Structure

```
users (email, phone, password)
    ↓
user_attributes (links users to attributes with values)
    ├── role_id → roles (admin, driver, customer)
    └── driver_id → drivers (if user is a driver)

attributes (defines available attributes like role_id, driver_id)
roles (defines available roles)
```

### Data Flow

```
POST /users/signup
    ↓
createUserRequest() validates role
    ↓
createVerificationRequest() sends OTP
    ↓
User verifies OTP
    ↓
createUserAfterOtpVerification()
    ├── Create user (email, phone, password)
    ├── Create user_attribute linking to role_id
    └── If driver: create user_attribute linking to driver_id
    ↓
Return auth token with role info
```

---

## API Endpoints

### 1. Signup (with role selection)

**POST** `/users/signup`

```json
{
  "email": "user@example.com",
  "phone": "+2348123456789",
  "password": "SecurePassword123",
  "role": "customer"
}
```

**Roles**: `admin` | `driver` | `customer`

**Response**:
```json
{
  "success": true,
  "data": {
    "request_id": "uuid-here",
    "message": "OTP sent to your email"
  }
}
```

### 2. Verify OTP

**POST** `/verify/otp`

```json
{
  "request_id": "uuid-from-signup",
  "otp": "1234"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "phone": "+2348123456789",
      "role": "customer"
    },
    "access_token": "jwt-token",
    "refresh_token": "jwt-refresh-token"
  }
}
```

### 3. Login

**POST** `/users/login`

```json
{
  "user_identification": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response**: (OTP required, then verify)

---

## User Attributes

### Role ID Attribute
- **Slug**: `role_id`
- **Values**: `admin`, `driver`, `customer`
- **Auto-assigned**: On signup

### Driver ID Attribute  
- **Slug**: `driver_id`
- **Values**: Driver ID from drivers table
- **Assigned**: When user role is `driver`

---

## Implementation Guide

### Signup with Role

```javascript
// Frontend
const signup = async (email, phone, password, role) => {
  const response = await fetch('/users/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, phone, password, role })
  });
  
  return response.json(); // { request_id }
};

// Verify OTP
const verifyOTP = async (request_id, otp) => {
  const response = await fetch('/verify/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id, otp })
  });
  
  const data = await response.json();
  localStorage.setItem('access_token', data.data.access_token);
  localStorage.setItem('user_role', data.data.user.role);
  
  return data.data;
};
```

### Check User Role

```javascript
// After login
const userRole = localStorage.getItem('user_role');

if (userRole === 'driver') {
  // Show driver dashboard
} else if (userRole === 'customer') {
  // Show customer dashboard
} else if (userRole === 'admin') {
  // Show admin dashboard
}
```

---

## Driver Assignment in Shipments

When a shipment is created for an internal carrier:

1. **Find available driver** based on `transport_mode`
2. **Create `user_attribute`** linking driver to user (if user is driver role)
3. **Assign to shipment** via `driver_id` field

```javascript
// In shipmentsController
if (isInternal && role === 'driver') {
  // Find driver by driver_id attribute
  // Assign to shipment
  // Update driver delivery count
}
```

---

## Database Seeding

### Roles
```sql
INSERT INTO roles (role, createdAt, updatedAt) VALUES
('admin', NOW(), NOW()),
('driver', NOW(), NOW()),
('customer', NOW(), NOW());
```

### Attributes
```sql
INSERT INTO attributes (name, slug, createdAt, updatedAt) VALUES
('Role ID', 'role_id', NOW(), NOW()),
('Driver ID', 'driver_id', NOW(), NOW());
```

Run with:
```bash
npm run seed
```

---

## Code Changes Summary

### Removed
- ❌ Zoho integration (createZohoSalesPerson, createIndividualOnZoho)
- ❌ Agent ID generation (generateAgentId)
- ❌ Sales person functionality
- ❌ Complex attribute handling
- ❌ Account type validation

### Updated
- ✅ `createUserRequest()` - Now validates role parameter
- ✅ `createUserAfterOtpVerification()` - Creates role_id attribute
- ✅ `loginAfterOtpVerification()` - Fetches and returns role
- ✅ `loginRequest()` - Simplified to basic auth
- ✅ User model - Cleaner, simpler

### Added  
- ✅ Role-based signup
- ✅ Role assignment via attributes
- ✅ Driver linking for driver users
- ✅ Migration for roles and attributes

---

## Error Handling

### Invalid Role on Signup
```json
{
  "success": false,
  "message": "Role is required and must be one of: admin, driver, customer"
}
```

### User Already Exists
```json
{
  "success": false,
  "message": "Email or Phone number already registered"
}
```

### Invalid OTP
```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

---

## Testing

### Test Admin Signup
```bash
curl -X POST http://localhost:3006/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "phone": "+2348100000001",
    "password": "AdminPass123",
    "role": "admin"
  }'
```

### Test Driver Signup
```bash
curl -X POST http://localhost:3006/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "phone": "+2348100000002",
    "password": "DriverPass123",
    "role": "driver",
    "driver_id": 1
  }'
```

### Test Customer Signup
```bash
curl -X POST http://localhost:3006/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "phone": "+2348100000003",
    "password": "CustomerPass123",
    "role": "customer"
  }'
```

---

## Next Steps

1. **Test the auth system** with different roles
2. **Implement role-based middleware** for protecting routes
3. **Add role-based features** (admin panels, driver dashboards, etc.)
4. **Set up frontend** to handle role-based UI

---

## References

- [User Model](src/models/userModel.js)
- [User Controller](src/controllers/userController.js)
- [User Routes](src/routes/users.js)
- [Verification Controller](src/controllers/verificationController.js)
- [Roles Migration](src/migrations/20260129-create-roles-and-attributes.js)
