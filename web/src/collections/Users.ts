import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'Sozlamalar',
    description: 'Admin panelga kira oladigan odamlar. Yangi admin qoʻshish: «Create new». Parolni kuchli qiling.',
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
