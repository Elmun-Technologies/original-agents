import type { CollectionConfig } from 'payload'

// Customers who pressed "Kelganda xabar berish" in the bot: one row per product size and Telegram chat.
// When the stock of that size becomes more than 0 they get one message and the row is deleted.
export const Waitlist: CollectionConfig = {
  slug: 'waitlist',
  admin: { hidden: true },
  access: { read: ({ req }) => !!req.user, create: () => false, update: () => false, delete: ({ req }) => !!req.user },
  indexes: [{ fields: ['sku', 'chat'], unique: true }],
  fields: [
    { name: 'sku', type: 'text', required: true, index: true },
    { name: 'chat', type: 'text', required: true },
    { name: 'lang', type: 'text' },
  ],
}
