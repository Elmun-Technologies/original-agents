import path from 'node:path'
import fs from 'node:fs'
import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

// Softer hero and AI-consultant photos (Unsplash License): swap the media-library copies again.
const FILES = ['hero-dewy.jpg', 'face-serum.jpg']

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
