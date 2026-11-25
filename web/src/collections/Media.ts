import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Katalog', description: 'Mahsulot, banner va maqola rasmlari. Rasmni AI bilan oʻzgartirmang — faqat asl surat.' },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    { name: 'caption', type: 'text', localized: true, admin: { description: 'Mahsulot galereyasidagi izoh: «Asl qadoq» …' } },
  ],
  upload: true,
}
