const jwt = require('jsonwebtoken')
const utils = require('../../utils.js')

const { getTenantAndEndpoint } = require('../helpers/requestValidator')
// Google OAuth integration
const passport = require('../config/passport');
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { getUser, getUserAttributes } = require('../controllers/userController');
// routes/auth.js
const axios = require('axios')
const db = require('../models/db.js');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// POST /auth/google_token/callback
router.post('/google_token/callback', async (req, res) => {
  const { code, redirect_uri } = req.body;
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing code or redirect_uri' });
  }

  try {
    // 1. Exchange code for tokens
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
      },
    });

    const { access_token, id_token } = tokenRes.data;

    // 2. Get user info from Google
    const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profile = userInfoRes.data;

    // 3. Check DB for user, create or update as needed
    const email = profile.email;
    let user_check = await db.users.findOne({ where: { email } });
    let user = null;

    if (user_check) {
      // Use the same logic as loginAfterOtpVerification
      user = await getUser(user_check.email, null, true, req, res, user_check.id);
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found. Please register.' });
    }    // Optionally update user info from Google profile

    // 4. Generate your app's tokens (JWT, etc.)
    const authDetail = await userController.createAuthDetail(user);

    // 5. Return tokens and user info to frontend
    res.json({
      access_token: authDetail.access_token,
      refresh_token: authDetail.refresh_token,
      user: authDetail.user,
      active_quote_id: authDetail.active_quote_id,
    });
  } catch (err) {
    console.error('Google OAuth error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Google OAuth failed' });
  }
});








// POST /auth/google_token/callback
router.post("/google_token/callback", async (req, res) => {
  const { code, redirect_uri } = req.body;

  if (!code || !redirect_uri) {
    return res.status(400).json({ error: "Missing code or redirect_uri" });
  }

  try {
    /** 1. Exchange authorization code for tokens */
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", null, {
      params: {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: "authorization_code",
      },
    });

    const { access_token, id_token } = tokenRes.data;
    if (!access_token || !id_token) {
      return res.status(400).json({ error: "Failed to obtain tokens from Google" });
    }

    /** 2. Get user info from Google */
    const { data: profile } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const email = profile?.email;
    if (!email) {
      return res.status(400).json({ error: "No email returned from Google profile" });
    }

    /** 3. Look up user in DB */
    let user_check = await db.users.findOne({ where: { email } });
    let user = null;

    if (user_check) {
      // Apply your existing login logic
      user = await getUser(user_check.email, null, true, req, res, user_check.id);
    }

    if (!user) {
      return res.status(401).json({ error: "User not found. Please register first." });
    }

    /** (Optional) Update user profile info from Google */
    await user_check.update({
      name: profile.name || user_check.name,
      picture: profile.picture || user_check.picture,
    });

    /** 4. Generate app tokens (JWT, etc.) */
    const authDetail = await userController.createAuthDetail(user);

    /** 5. Send response */
    return res.json({
      access_token: authDetail.access_token,
      refresh_token: authDetail.refresh_token,
      user: authDetail.user,
      active_quote_id: authDetail.active_quote_id,
    });

  } catch (err) {
    console.error("Google OAuth error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Google OAuth failed", details: err.message });
  }
});

// Google OAuth login route
router.get("/google", (req, res, next) => {
  const redirectUri = req.query.redirect_uri;
  const failUri = req.query.fail_uri || redirectUri; // default fallback

  if (!redirectUri) {
    return res.status(400).send("Missing redirect_uri");
  }

  // Encode both in state (safe string)
  const statePayload = JSON.stringify({ redirectUri, failUri });

  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account consent",
    state: Buffer.from(statePayload).toString("base64"), // encode state
  })(req, res, next);
});

// Google OAuth callback
router.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", { session: false }, async (err, user, info) => {
      let redirectUri = "/";
      let failUri = "/Register";
      // Decode state back
      if (req.query.state) {
        try {
          const { redirectUri: r, failUri: f } = JSON.parse(
            Buffer.from(req.query.state, "base64").toString("utf8")
          );
          redirectUri = r;
          failUri = f;
        } catch (e) {
          console.error("Failed to parse state:", e);
        }
      }


      // Case 1: Failed login (no user, or error)
      if (err || !user) {
        let params = new URLSearchParams({ error: "oauth_failed" });

        // include Google profile if available
        const profile = info?.profile;
        if (profile) {
          if (profile.emails?.[0]?.value) {
            params.set("email", profile.emails[0].value);
          }
          if (profile.displayName) {
            params.set("name", profile.displayName);
          }
        }

        return res.redirect(`${failUri}?${params.toString()}`);
      }

      try {
        // Success → generate tokens
        const authDetail = await userController.createAuthDetail(
          user.toJSON ? user.toJSON() : user
        );

        const query = new URLSearchParams({
          access_token: authDetail.access_token,
          refresh_token: authDetail.refresh_token,
          user: JSON.stringify(authDetail.user),
          active_quote_id: JSON.stringify(authDetail.active_quote_id)
        }).toString();

        return res.redirect(`${redirectUri}/oauth-success?${query}`);
      } catch (e) {
        console.error("OAuth error:", e);
        return res.redirect(`${failUri}?error=oauth_failed`);
      }
    })(req, res, next);
  }
);



/**
 * Authentication
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  const storeName = req.query.store_name
  const { tenant, endpoint } = req.params.tenant ? await getTenantAndEndpoint(req.params, res) : { endpoint: null, tenant: null }

  if (!(token || storeName || endpoint?.require_authentication)) {
    return res.status(401).send(
      utils.responseError('Authentication failed')
    )
  }
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, user) => {
      if (error) {
        return res.status(403).send(
          utils.responseError('Access denied')
        )
      }
      req.user = user
      next()
    })
    return
  }

  if (storeName) {
    const store = await storeController.authStore(storeName)
    if (!store) {
      return res.status(403).send(
        utils.responseError('Access denied')
      )
    }

    req.user = store.user
    next()
  } else if (endpoint.require_authentication) {
    if (endpoint.require_authentication !== 'false')
      return res.status(403).send(
        utils.responseError('Access denied')
      )
    next()
  }
}

module.exports = {
  authenticateToken,
  router
}

