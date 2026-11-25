// Creates the first admin account (or resets its password):
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long password' pnpm admin:create
// Local database only through .env; on the server run it inside the web container.
import { getPayload } from 'payload'

import config from '../src/payload.config'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
if (!email || !password || password.length < 10) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters).')
  process.exit(1)
}
const payload = await getPayload({ config: await config })
const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
if (found.docs[0]) {
  await payload.update({ collection: 'users', id: found.docs[0].id, data: { password }, overrideAccess: true })
  console.log(`password updated for ${email}`)
} else {
  await payload.create({ collection: 'users', data: { email, password }, overrideAccess: true })
  console.log(`admin created: ${email}`)
}
process.exit(0)
