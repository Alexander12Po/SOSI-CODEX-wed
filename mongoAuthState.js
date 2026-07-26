import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys'
import { MongoClient } from 'mongodb'

// -----------------------------------------------------------------------
// Guarda el estado de sesión de Baileys (creds + keys) en MongoDB en vez
// de en la carpeta local `./session`. Esto es NECESARIO en Render, porque
// su sistema de archivos es efímero: cada redeploy o reinicio borra los
// archivos locales y te obligaría a escanear el QR / pedir el código de
// nuevo. Guardando todo en Mongo, la sesión sobrevive a los reinicios.
// -----------------------------------------------------------------------

let client
let collection

async function getCollection() {
  if (collection) return collection

  client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()

  // Usa la base de datos indicada en la propia URI (en tu caso "SOSI-CODEX")
  const db = client.db()
  collection = db.collection('baileys_auth')
  return collection
}

async function writeData(id, data) {
  const col = await getCollection()
  const value = JSON.stringify(data, BufferJSON.replacer)
  await col.updateOne({ _id: id }, { $set: { value } }, { upsert: true })
}

async function readData(id) {
  try {
    const col = await getCollection()
    const doc = await col.findOne({ _id: id })
    if (!doc) return null
    return JSON.parse(doc.value, BufferJSON.reviver)
  } catch {
    return null
  }
}

async function removeData(id) {
  const col = await getCollection()
  await col.deleteOne({ _id: id })
}

export async function useMongoAuthState() {
  const creds = (await readData('creds')) || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {}
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`)
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value)
              }
              data[id] = value
            })
          )
          return data
        },
        set: async (data) => {
          const tasks = []
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id]
              const key = `${category}-${id}`
              tasks.push(value ? writeData(key, value) : removeData(key))
            }
          }
          await Promise.all(tasks)
        }
      }
    },
    saveCreds: () => writeData('creds', creds)
  }
}

// Útil si alguna vez necesitas forzar un logout limpio y borrar la sesión
// guardada en Mongo (equivalente a borrar la carpeta ./session).
export async function clearMongoAuthState() {
  const col = await getCollection()
  await col.deleteMany({})
}
