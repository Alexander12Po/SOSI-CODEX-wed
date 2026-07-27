import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys'
import { MongoClient } from 'mongodb'

// -----------------------------------------------------------------------
// Guarda el estado de sesión de Baileys (creds + keys) en MongoDB en vez
// de en la carpeta local `./session`. Esto es NECESARIO en Render, porque
// su sistema de archivos es efímero: cada redeploy o reinicio borra los
// archivos locales y te obligaría a escanear el QR / pedir el código de
// nuevo. Guardando todo en Mongo, la sesión sobrevive a los reinicios.
//
// ACTUALIZACIÓN: ahora soporta múltiples sesiones simultáneas (multi-
// tenant). Cada sesión se identifica con un `sessionId` (por defecto
// 'main', que es la sesión del bot principal). Las claves en Mongo se
// prefijan con ese sessionId para que no se pisen entre sí.
// -----------------------------------------------------------------------

let client
let authCollection
let registryCollection

async function getDb() {
  if (client) return client.db()
  client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  return client.db()
}

async function getAuthCollection() {
  if (authCollection) return authCollection
  const db = await getDb()
  authCollection = db.collection('baileys_auth')
  return authCollection
}

async function getRegistryCollection() {
  if (registryCollection) return registryCollection
  const db = await getDb()
  registryCollection = db.collection('baileys_sessions_registry')
  return registryCollection
}

function scopedId(sessionId, id) {
  return `${sessionId}::${id}`
}

async function writeData(sessionId, id, data) {
  const col = await getAuthCollection()
  const value = JSON.stringify(data, BufferJSON.replacer)
  await col.updateOne({ _id: scopedId(sessionId, id) }, { $set: { value } }, { upsert: true })
}

async function readData(sessionId, id) {
  try {
    const col = await getAuthCollection()
    const doc = await col.findOne({ _id: scopedId(sessionId, id) })
    if (!doc) return null
    return JSON.parse(doc.value, BufferJSON.reviver)
  } catch {
    return null
  }
}

async function removeData(sessionId, id) {
  const col = await getAuthCollection()
  await col.deleteOne({ _id: scopedId(sessionId, id) })
}

export async function useMongoAuthState(sessionId = 'main') {
  const creds = (await readData(sessionId, 'creds')) || initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {}
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(sessionId, `${type}-${id}`)
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
              tasks.push(value ? writeData(sessionId, key, value) : removeData(sessionId, key))
            }
          }
          await Promise.all(tasks)
        }
      }
    },
    saveCreds: () => writeData(sessionId, 'creds', creds)
  }
}

// Útil si alguna vez necesitas forzar un logout limpio y borrar la sesión
// guardada en Mongo (equivalente a borrar la carpeta ./session).
export async function clearMongoAuthState(sessionId = 'main') {
  const col = await getAuthCollection()
  await col.deleteMany({ _id: { $regex: `^${sessionId}::` } })
  await unregisterSession(sessionId)
}

// -----------------------------------------------------------------------
// Registro de sesiones activas. Necesario para que, cuando Render
// reinicie el servicio, el bot sepa cuáles sesiones de sub-usuarios
// existían y las reconecte automáticamente sin pedirles escanear de nuevo.
// -----------------------------------------------------------------------

export async function registerSession(sessionId) {
  const col = await getRegistryCollection()
  await col.updateOne(
    { _id: sessionId },
    { $set: { sessionId, updatedAt: new Date() } },
    { upsert: true }
  )
}

export async function unregisterSession(sessionId) {
  const col = await getRegistryCollection()
  await col.deleteOne({ _id: sessionId })
}

export async function listRegisteredSessions() {
  const col = await getRegistryCollection()
  const docs = await col.find({}).toArray()
  return docs.map(d => d.sessionId)
}
