import type { CollectionConfig } from 'payload'

// Our own visitor analytics (no cookies shared with anyone, no personal data). Written only by the server
// (app/api/t and the order code), read only by the admin screens.
export const AnalyticsEvents: CollectionConfig = {
  slug: 'analytics-events',
  admin: { hidden: true },
  access: { read: ({ req }) => !!req.user, create: () => false, update: () => false, delete: ({ req }) => !!req.user },
  indexes: [{ fields: ['name', 'createdAt'] }, { fields: ['path', 'createdAt'] }, { fields: ['session', 'createdAt'] }],
  fields: [
    { name: 'name', type: 'text', required: true, index: true },
    { name: 'visitor', type: 'text', required: true, index: true },
    { name: 'session', type: 'text', required: true, index: true },
    { name: 'path', type: 'text', required: true },
    { name: 'lang', type: 'text' },
    { name: 'device', type: 'text' },
    { name: 'ref', type: 'text' },
    { name: 'src', type: 'text' },
    { name: 'med', type: 'text' },
    { name: 'cmp', type: 'text' },
    { name: 'data', type: 'json' },
  ],
}
