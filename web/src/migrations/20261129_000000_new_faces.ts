import path from 'node:path'
import fs from 'node:fs'
import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

// New, warmer people photos (Unsplash License). The files in public/img are already replaced;
// this swaps the copies the shop keeps in the media library, so banners and galleries change too.
const FILES = ['hero-dewy.jpg', 'face-serum.jpg', 'face-flower.jpg', 'face-white.jpg', 'face-touch.jpg', 'face-glow.jpg', 'face-leaf.jpg', 'face-peach.jpg']

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const dir = path.resolve(process.cwd(), 'public', 'img')
  for (const file of FILES) {
    const filePath = path.join(dir, file)
    if (!fs.existsSync(filePath)) continue
    const { docs } = await payload.find({ collection: 'media', where: { filename: { equals: file } }, limit: 5, req })
    for (const doc of docs) {
      try {
        await payload.update({ collection: 'media', id: doc.id, data: {}, filePath, overwriteExistingFiles: true, req })
      } catch (e) {
        payload.logger.warn(`new_faces: ${file} not replaced: ${(e as Error).message}`)
      }
    }
  }
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // photos are not restored
}
