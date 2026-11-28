import type { CollectionConfig, Field, GlobalConfig } from 'payload'

// Money the shop spends, entered by the owner (Admin → Moliya → Xarajatlar), and the rule for payment fees.
// The finance report (Admin → Moliya hisoboti) puts this next to the money customers paid.
const admin = ({ req }: { req: { user?: unknown } }) => !!req.user

export const EXPENSE_CATEGORIES = [
  { value: 'ads', label: 'Reklama' },
  { value: 'delivery', label: 'Yetkazish (kuryer, pochta)' },
  { value: 'packing', label: 'Qadoq va sovgʻa qutilari' },
  { value: 'salary', label: 'Ish haqi' },
  { value: 'rent', label: 'Ijara va kommunal' },
  { value: 'services', label: 'Server, SMS va boshqa xizmatlar' },
  { value: 'tax', label: 'Soliq' },
  { value: 'other', label: 'Boshqa' },
] as const

export const Expenses: CollectionConfig = {
  slug: 'expenses',
  labels: { singular: 'Xarajat', plural: 'Xarajatlar' },
  admin: { group: 'Moliya', useAsTitle: 'note', defaultColumns: ['date', 'category', 'amount', 'note'],
    description: 'Doʻkon uchun qilingan har bir xarajatni yozing. Tovar sotib olish puli bu yerga yozilmaydi: sotilgan tovar tannarxi mahsulot kartasidagi «Tannarx» dan olinadi.' },
  access: { read: admin, create: admin, update: admin, delete: admin },
  fields: [
    { name: 'date', label: 'Sana', type: 'date', required: true, defaultValue: () => new Date().toISOString(), admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' } } },
    { name: 'category', label: 'Turi', type: 'select', required: true, options: EXPENSE_CATEGORIES as unknown as { value: string; label: string }[], index: true },
    { name: 'amount', label: 'Summa (soʻm)', type: 'number', required: true, min: 0 },
    { name: 'channel', label: 'Reklama manbai', type: 'text', admin: { condition: (_, s) => s?.category === 'ads', description: 'Havola yasagichdagi «manba» bilan bir xil yozing (masalan instagram, telegram, google). Shunda hisobotda shu manbadan kelgan pul yonida koʻrinadi.' } },
    { name: 'note', label: 'Izoh', type: 'text', admin: { description: 'Masalan: «Instagram reklama, 1–7 dekabr»' } },
  ],
}

export const FinanceSettings: GlobalConfig = {
  slug: 'finance',
  label: 'Moliya sozlamalari',
  admin: { group: 'Moliya' },
  access: { read: admin, update: admin },
  fields: [
    { name: 'clickFeePct', label: 'Click komissiyasi (%)', type: 'number', min: 0, max: 10, admin: { description: 'Shartnomangizdagi foiz, masalan 1.5. Boʻsh boʻlsa hisobotda komissiya hisoblanmaydi.' } },
    { name: 'paymeFeePct', label: 'Payme komissiyasi (%)', type: 'number', min: 0, max: 10, admin: { description: 'Uzcard/Humo toʻlovlari ham shu tizim orqali oʻtsa, shu foiz olinadi.' } },
  ],
}

/** Purchase price: only a logged-in admin reads it through the API (REST/GraphQL). The site's own server code reads
 * products with full access, so it must never hand a whole product/order document to the browser: it maps the
 * fields it shows (lib/catalog productData, the order page). tests/int/launch-tools checks the shop pages. */
export const costField = (description: string): Field => ({
  name: 'cost', label: 'Tannarx (soʻm)', type: 'number', min: 0,
  access: { read: admin, create: admin, update: admin },
  admin: { description },
})
