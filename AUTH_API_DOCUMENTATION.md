# 🔐 Authentication API Documentation

Complete API documentation for the simplified auth system with roles (admin, driver, customer).

---

## Base URL
```
http://localhost:3006
```

---

## 📋 Table of Contents
1. [Signup](#signup)
2. [Verify OTP](#verify-otp)
3. [Login](#login)
4. [Refresh Token](#refresh-token)
5. [Logout](#logout)
6. [Error Responses](#error-responses)
7. [Testing Checklist](#testing-checklist)

---

## Signup

Create a new user account with role selection.

### Endpoint
```
POST /users/signup
```

### Headers
```
Content-Type: application/json
```

### Request Body

#### Customer Signup
```json
{
  "email": "customer@example.com",
  "phone": "+2348100000001",
  "password": "SecurePassword123",
  "role": "customer"
}
```

#### Driver Signup
```json
{
  "email": "driver@example.com",
  "phone": "+2348100000002",
  "password": "DriverPassword123",
  "role": "driver",
  "driver_id": 1
}
```

#### Admin Signup
```json
{
  "email": "admin@example.com",
  "phone": "+2348100000003",
  "password": "AdminPassword123",
  "role": "admin"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Verification request created",
  "data": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Error Response (400)
```json
{
  "success": false,
  "message": "Role is required and must be one of: admin, driver, customer"
}
```

### Error Response (401)
```json
{
  "success": false,
  "message": "Email or Phone number already registered"
}
```

### cURL Example
```bash
curl -X POST http://localhost:3006/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "phone": "+2348100000001",
    "password": "TestPass123",
    "role": "customer"
  }'
```

---

## Verify OTP

Verify the OTP sent to user email and get authentication tokens.

### Endpoint
```
POST /verify/otp
```

### Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "otp": "1234"
}
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "customer@example.com",
      "phone": "+2348100000001",
      "role": "customer"
    },
    "active_quote_id": null,
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwi...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwi..."
  }
}
```

### Error Response (401)
```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

### Notes
- Save `access_token` for API authentication
- Save `refresh_token` for token refresh
- Save `user.role` for UI role-based rendering
- OTP expires after a certain period (check env config)

### cURL Example
```bash
curl -X POST http://localhost:3006/verify/otp \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "otp": "1234"
  }'
```

---

## Login

Authenticate existing user.

### Endpoint
```
POST /users/login
```

### Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "user_identification": "customer@example.com",
  "password": "SecurePassword123",
  "remember_me": 0
}
```

**Note**: `user_identification` can be either email or phone number.

### Response (Step 1 - OTP Required)
```json
{
  "success": true,
  "message": "Verification request created",
  "data": {
    "request_id": "660e8400-e29b-41d4-a716-446655440001"
  }
}
```

### Then Verify OTP
```json
{
  "request_id": "660e8400-e29b-41d4-a716-446655440001",
  "otp": "1234"
}
```

### Final Response (After OTP Verification)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "customer@example.com",
      "phone": "+2348100000001",
      "role": "customer"
    },
    "active_quote_id": null,
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Error Response - User Not Found (401)
```json
{
  "success": false,
  "message": "User not found. Check your credentials and try again"
}
```

### Error Response - Wrong Password (401)
```json
{
  "success": false,
  "message": "Wrong password. Check your credentials and try again"
}
```

### cURL Example
```bash
# Step 1: Request login
curl -X POST http://localhost:3006/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "user_identification": "customer@example.com",
    "password": "SecurePassword123"
  }'

# Step 2: Verify OTP (using request_id from Step 1)
curl -X POST http://localhost:3006/verify/otp \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "660e8400-e29b-41d4-a716-446655440001",
    "otp": "1234"
  }'
```

---

## Refresh Token

Get a new access token using refresh token.

### Endpoint
```
POST /users/token
```

### Headers
```
Content-Type: application/json
```

### Request Body
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Success Response (201)
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Error Response - No Token (401)
```json
{
  "success": false,
  "message": "Authentication failed"
}
```

### Error Response - Invalid Token (403)
```json
{
  "success": false,
  "message": "Access Denied"
}
```

### cURL Example
```bash
curl -X POST http://localhost:3006/users/token \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

## Logout

Invalidate refresh token and logout user.

### Endpoint
```
POST /users/logout
```

### Headers
```
Content-Type: application/json
Authorization: Bearer <access_token>
```

### Request Body
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Success Response (204)
```json
{
  "success": true,
  "message": "You have been logged out successfully"
}
```

### Error Response - No Token (403)
```json
{
  "success": false,
  "message": "Refresh Token is not present"
}
```

### cURL Example
```bash
curl -X POST http://localhost:3006/users/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "success": false,
  "message": "Invalid request parameters"
}
```

### 401 - Unauthorized
```json
{
  "success": false,
  "message": "Authentication failed or invalid credentials"
}
```

### 403 - Forbidden
```json
{
  "success": false,
  "message": "Access Denied"
}
```

### 422 - Unprocessable Entity
```json
{
  "success": false,
  "message": "Validation error or processing failed"
}
```

### 500 - Internal Server Error
```json
{
  "success": false,
  "message": "Error creating user/processing request"
}
```

---

## Testing Checklist

### ✅ Customer Signup Flow
- [ ] POST `/users/signup` with role: customer
- [ ] Get request_id
- [ ] POST `/verify/otp` with OTP from email
- [ ] Verify user.role === "customer"
- [ ] Check access_token is returned

### ✅ Driver Signup Flow
- [ ] POST `/users/signup` with role: driver and driver_id
- [ ] Get request_id
- [ ] POST `/verify/otp` with OTP
- [ ] Verify user.role === "driver"
- [ ] Check driver_id is linked in database

### ✅ Admin Signup Flow
- [ ] POST `/users/signup` with role: admin
- [ ] Get request_id
- [ ] POST `/verify/otp` with OTP
- [ ] Verify user.role === "admin"

### ✅ Login Flow
- [ ] POST `/users/login` with email
- [ ] POST `/users/login` with phone
- [ ] Verify OTP step works
- [ ] Check tokens are returned

### ✅ Token Refresh
- [ ] POST `/users/token` with valid refresh_token
- [ ] Get new access_token
- [ ] Try with invalid token (should fail)

### ✅ Logout
- [ ] POST `/users/logout` with valid refresh_token
- [ ] Try using same token again (should fail)

### ✅ Error Cases
- [ ] Signup with invalid role (should fail)
- [ ] Signup with duplicate email (should fail)
- [ ] Login with wrong password (should fail)
- [ ] Verify with wrong OTP (should fail)
- [ ] Invalid request_id (should fail)

---

## Testing with Postman

### Step 1: Create Environment Variables
```
base_url = http://localhost:3006
access_token = (set after verify OTP)
refresh_token = (set after verify OTP)
request_id = (set after signup/login)
```

### Step 2: Test Signup
- Create new POST request: `{{base_url}}/users/signup`
- Set raw JSON body with customer/driver/admin details
- Send and save `request_id` to environment

### Step 3: Test OTP Verification
- Create new POST request: `{{base_url}}/verify/otp`
- Use saved `request_id` and OTP from email (check console)
- Save `access_token` and `refresh_token` to environment

### Step 4: Test Protected Endpoints
- Use `access_token` in Authorization header: `Bearer {{access_token}}`

---

## JavaScript/Fetch Examples

### Complete Signup and Login Flow
```javascript
// Step 1: Signup
async function signup(email, phone, password, role, driver_id = null) {
  const payload = { email, phone, password, role };
  if (driver_id) payload.driver_id = driver_id;
  
  const response = await fetch('http://localhost:3006/users/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  
  return data.data.request_id; // Return for OTP verification
}

// Step 2: Verify OTP
async function verifyOTP(request_id, otp) {
  const response = await fetch('http://localhost:3006/verify/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id, otp })
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  
  // Save tokens
  localStorage.setItem('access_token', data.data.access_token);
  localStorage.setItem('refresh_token', data.data.refresh_token);
  localStorage.setItem('user_role', data.data.user.role);
  localStorage.setItem('user_id', data.data.user.id);
  
  return data.data;
}

// Step 3: Login
async function login(user_identification, password) {
  const response = await fetch('http://localhost:3006/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_identification, password })
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  
  return data.data.request_id; // Return for OTP verification
}

// Step 4: Logout
async function logout() {
  const refresh_token = localStorage.getItem('refresh_token');
  const access_token = localStorage.getItem('access_token');
  
  const response = await fetch('http://localhost:3006/users/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`
    },
    body: JSON.stringify({ refresh_token })
  });
  
  const data = await response.json();
  
  // Clear tokens
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_id');
  
  return data;
}

// Example Usage
(async () => {
  try {
    // Signup
    const requestId = await signup(
      'newuser@example.com',
      '+2348100000001',
      'Password123',
      'customer'
    );
    console.log('Signup successful, request_id:', requestId);
    
    // In real app, user enters OTP from email
    const otp = '1234'; // Get from user input
    
    // Verify OTP
    const authData = await verifyOTP(requestId, otp);
    console.log('Authenticated:', authData.user);
    
    // Later - Logout
    await logout();
    console.log('Logged out successfully');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
```

---

## Important Notes

### Security
- Always use HTTPS in production
- Store tokens securely (HttpOnly cookies preferred over localStorage)
- Never commit real tokens to version control
- Set appropriate token expiration times

### OTP
- OTP is sent to email (check console in development)
- Default OTP is 4 digits
- OTP expires after configured time
- Each signup/login generates a new OTP

### Roles
- `customer`: Regular user for orders
- `driver`: Can deliver shipments, get assignments
- `admin`: Full system access

### Tokens
- `access_token`: Use for API requests (short-lived)
- `refresh_token`: Use to get new access_token (long-lived)
- Always include access_token in Authorization header

---

## Troubleshooting

### "Role is required and must be one of: admin, driver, customer"
- Check that `role` parameter is included
- Verify role value is exactly one of: admin, driver, customer

### "Email or Phone number already registered"
- Use a different email/phone combination
- Or login if account exists

### "Invalid OTP"
- Check OTP from email (in console if development)
- Verify OTP hasn't expired
- Check you're using correct request_id

### "User not found"
- Verify email/phone during login
- Check user was successfully created

### Tokens not working
- Verify token format is correct
- Check token hasn't expired
- Use refresh_token to get new access_token

---

## Environment Variables

```env
# JWT
ACCESS_TOKEN_SECRET=your-secret-key
REFRESH_TOKEN_SECRET=your-refresh-secret
ACCESS_TOKEN_SECRET_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET_REMEMBER_ME=30d

# Database
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=obana_logistics
DB_DIALECT=postgres
DB_PORT=5432

# Email (for OTP)
MAIL_SERVICE=gmail
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
```

---

**Last Updated**: January 29, 2026
**API Version**: 1.0.0
**Status**: Production Ready ✅
