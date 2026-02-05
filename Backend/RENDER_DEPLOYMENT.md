# 🚀 Deployment to Render.com

## Complete Render Deployment Guide

### Prerequisites
- Render.com account
- PostgreSQL database on Render
- Environment variables configured

---

## ✅ Step 1: Set Environment Variables on Render

In your Render service dashboard, go to **Environment** and add:

```env
DB_HOST=your-database-host.postgres.render.com
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_database_name
DB_PORT=5432
DB_DIALECT=postgres
NODE_ENV=production
```

---

## ✅ Step 2: Run Migrations on Render

There are **two options** to run migrations:

### Option A: Automatic Migrations (Recommended)
Your `package.json` has this `prestart` hook:

```json
"prestart": "npm run migrate:up"
```

This means **migrations run automatically** when the service starts! ✅

### Option B: Manual Migrations (If Needed)
1. Go to Render dashboard → Your service
2. Click **Shell** tab
3. Run: `npm run migrate:up`

---

## ✅ Step 3: Seed Database on Render

Now that we've added the seed script, you can seed drivers:

### Option A: Via Render Shell (Recommended)
1. Open your Render service → **Shell** tab
2. Run:
   ```bash
   npm run seed
   ```
3. Or run migrations + seeds together:
   ```bash
   npm run seed:all
   ```

### Option B: Via Node Console
1. Open Render Shell
2. Run:
   ```bash
   node scripts/seed-database.js
   ```

### Option C: SSH into Render
```bash
# SSH into your service
render exec -s your-service-name npm run seed
```

---

## 📋 Deployment Checklist

- [ ] Push code to Git (migrations, seed script, driver assignment code)
- [ ] Render auto-deploys and runs migrations via `prestart`
- [ ] Open Render Shell and run: `npm run seed`
- [ ] Verify drivers are seeded: Check database or make test shipment request
- [ ] Confirm driver_id is not null in shipment response

---

## 🔍 Verify Seeding Worked

### Via Render Shell
```bash
node -e "const db = require('./src/models/db'); db.drivers.findAll().then(d => console.table(d)).catch(e => console.error(e))"
```

### Via API
Create a shipment request:
```bash
curl -X POST http://your-render-service.onrender.com/api/shipments \
  -H "Content-Type: application/json" \
  -d '{"transport_mode":"road","service_level":"Standard",...}'
```

Check the response for `"driver_id": null` → if it's assigned, seeding worked! ✅

---

## 🐛 Troubleshooting

### "No available driver found for transport_mode: road"
**Solution:** Run `npm run seed` in Render Shell

### "Cannot find module 'src/config/MigrationConfig.js'"
**Solution:** Make sure all files are pushed to Git

### "Connection refused"
**Solution:** Verify DB_HOST, DB_USER, DB_PASSWORD in Environment variables

### "duplicate key value violates unique constraint"
**Solution:** The seed script has `ON CONFLICT DO NOTHING`, should skip. If still fails:
```bash
# In Render Shell:
node scripts/seed-database.js
```

---

## 📊 What Gets Seeded

### Drivers
- **OBANA-DRV-001**: Car driver, 45 deliveries, 4.8★ rating
- **OBANA-DRV-002**: Bike driver, 128 deliveries, 4.9★ rating

Both drivers:
- Status: `active`
- Linked to users 12 and 13
- Have metadata (phone, email, rating)
- Ready for auto-assignment

---

## 🔄 Running Seeders Every Time (Optional)

If you want seeders to run automatically on every deploy:

**Option 1: Update package.json prestart**
```json
"prestart": "npm run migrate:up && npm run seed"
```

**Option 2: Keep manual** (safer, prevents accidental data resets)
Keep current setup and run manually when needed.

---

## 📝 Notes

- Seed script is **idempotent** - safe to run multiple times
- Will skip if drivers already exist
- Does NOT delete existing drivers
- Safe for production use

---

## ✨ You're Ready!

After seeding, new shipments will automatically get assigned to available drivers! 🎉
