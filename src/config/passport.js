const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userModel = require('../models/db.js').users;
const db = require('../models/db.js');
const { getUser, getUserAttributes } = require('../controllers/userController');



passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',

},
  async (accessToken, refreshToken, profile, done) => {
    // Find in DB
    try {
      const db = require('../models/db.js');
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

      if (!email) {
        return done(new Error('No email found in Google profile'));
      }

      let user_check = await db.users.findOne({ where: { email } });
      const attributes = await getUserAttributes(user_check.id);

      let user;

      if (user_check) {
        user = await getUser(user_check.email, null, true, null, null, user_check.id);
        const attributes = await getUserAttributes(user.id);
        return done(null, user);
      }
      // Not found → pass profile for later registration
      return done(null, false, { profile });
    } catch (err) {
      return done(err, false, { profile });
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user_check = await db.users.findByPk(id);
    const user = await getUser(user_check.email, null, true, null, null, user_check.id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
