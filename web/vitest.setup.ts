// Load .env files
import 'dotenv/config'

// Tests write orders and payments. Point them at their own database so the one the site runs on stays clean:
//   TEST_DATABASE_URI=postgres://yeppo:yeppo@localhost:5434/yeppo_test pnpm test:int
if (process.env.TEST_DATABASE_URI) process.env.DATABASE_URI = process.env.TEST_DATABASE_URI
process.env.ADMIN_NOTIFY = 'off' // never message the admin from a test
process.env.PAYMENTS_MODE = 'mock'
