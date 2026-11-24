// plugins/igr.js
import axios from 'axios'

class InstagramChecker {
  constructor() {
    this.session = axios.create({
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        'x-ig-app-id': '936619743392459'
      }
    })
    this.csrf = null
    this.lsd = null
    this.doc_id = '26672929172408668'
  }

  async ensureTokens() {
    if (this.csrf && this.lsd) return true
    try {
      const response = await this.session.get('https://www.instagram.com/')
      if (response.status === 200) {
        const cookies = response.headers['set-cookie']
        const csrfCookie = cookies?.find(c => c.startsWith('csrftoken='))
        if (csrfCookie) this.csrf = csrfCookie.split(';')[0].split('=')[1]
        const lsdMatch = response.data.match(/"LSD",\[\],\{"token":"([^"]+)"\}/)
        if (lsdMatch) this.lsd = lsdMatch[1]
        return !!(this.csrf && this.lsd)
      }
    } catch (error) { console.error('Error tokens IG:', error.message) }
    return false
  }

  async getUserIdFromUsername(username) {
    try {
      const response = await this.session.get(`https://www.instagram.com/${username}/?__a=1&__d=dis`)
      if (response.status === 200 && response.data?.graphql?.user) return response.data.graphql.user.id
    } catch (error) {
      try {
        const response = await this.session.get(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
          headers: { 'x-ig-app-id': '936619743392459' }
        })
        if (response.status === 200 && response.data?.data?.user) return response.data.data.user.id
      } catch (err) { return null }
    }
    return null
  }

  async getUserData(userId) {
    if (!await this.ensureTokens()) throw new Error('No se pudieron obtener los tokens')
    const url = 'https://www.instagram.com/api/graphql'
    const variables = {
      enable_integrity_filters: true, id: String(userId),
      '__relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider': true,
      '__relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider': false,
      '__relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider': false,
      '__relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider': false,
    }
    const payload = new URLSearchParams({
      lsd: this.lsd, fb_api_caller_class: 'RelayModern',
      fb_api_req_friendly_name: 'PolarisProfilePageContentQuery',
      variables: JSON.stringify(variables), server_timestamps: 'true', doc_id: this.doc_id,
    })
    try {
      const response = await this.session.post(url, payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-bloks-version-id': 'f0fd53409d7667526e529854656fe20159af8b76db89f40c333e593b51a2ce10',
          'x-ig-app-id': '936619743392459', 'x-fb-lsd': this.lsd, 'x-csrftoken': this.csrf,
          'x-fb-friendly-name': 'PolarisProfilePageContentQuery',
          'origin': 'https://www.instagram.com', 'referer': 'https://www.instagram.com/'
        }
      })
      if (response.status === 200) {
        const user = response.data?.data?.user
        if (user && user.username) return user
      }
    } catch (error) { console.error('Error datos usuario:', error.message) }
    return null
  }

  async checkEmailBloks(email) {
    const url = 'https://i.instagram.com/api/v1/bloks/async_action/com.bloks.www.caa.ar.search.async/'
    const device = 'android-' + Math.random().toString(16).slice(2, 18)
    const family = crypto.randomUUID()
    const android = 'android-' + Math.random().toString(16).slice(2, 18)
    const payload = {
      params: JSON.stringify({
        client_input_params: {
          aac: JSON.stringify({ aac_init_timestamp: Math.floor(Date.now() / 1000), aacjid: crypto.randomUUID(), aaccs: crypto.randomUUID() }),
          search_query: email, ig_android_qe_device_id: device, device_id: android, family_device_id: family, waterfall_id: crypto.randomUUID()
        },
        server_params: { event_request_id: crypto.randomUUID(), device_id: android, family_device_id: family, qe_device_id: device }
      }),
      bk_client_context: JSON.stringify({ bloks_version: '5e47baf35c5a270b44c8906c8b99063564b30ef69779f3dee0b828bee2e4ef5b', styles_id: 'instagram' }),
      bloks_versioning_id: '5e47baf35c5a270b44c8906c8b99063564b30ef69779f3dee0b828bee2e4ef5b'
    }
    try {
      const response = await axios.post(url, new URLSearchParams(payload).toString(), {
        headers: {
          'User-Agent': 'Instagram 320.0.0.34.109 Android (33/13; 420dpi; 1080x2340; samsung; SM-A546B; a54x; exynos1380; en_US; 465123678)',
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-bloks-version-id': '5e47baf35c5a270b44c8906c8b99063564b30ef69779f3dee0b828bee2e4ef5b',
          'x-ig-android-id': android, 'x-ig-app-id': '567067343352427', 'x-ig-device-id': device, 'x-ig-family-device-id': family,
          'origin': 'https://www.instagram.com'
        }, timeout: 20000
      })
      return response.data.includes(email)
    } catch (error) { return false }
    return false
  }

  async checkEmailWebCreate(email) {
    if (!await this.ensureTokens()) return false
    const url = 'https://www.instagram.com/api/v1/web/accounts/web_create_ajax/attempt/'
    const username = 'testuser_' + Math.floor(Math.random() * 90000 + 10000)
    const data = new URLSearchParams({ email, username, first_name: 'Test', password: 'Test@123456' })
    try {
      const response = await this.session.post(url, data.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', 'x-csrftoken': this.csrf,
          'x-ig-app-id': '936619743392459', 'origin': 'https://www.instagram.com',
          'referer': 'https://www.instagram.com/accounts/emailsignup/'
        }
      })
      if (response.status === 200) return 'email' in (response.data.errors || {})
    } catch (error) { return false }
    return false
  }

  async checkEmail(email) {
    if (await this.checkEmailBloks(email)) return true
    if (await this.checkEmailWebCreate(email)) return true
    return false
  }

  async fetchResetEmail(username) {
    try {
      const response = await axios.post(
        'https://www.instagram.com/api/v1/web/accounts/account_recovery_send_ajax/',
        new URLSearchParams({ email_or_username: username }).toString(),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'x-ig-app-id': '936619743392459', 'x-requested-with': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded', 'origin': 'https://www.instagram.com',
            'referer': 'https://www.instagram.com/accounts/password/reset/'
          }, timeout: 10000
        }
      )
      if (response.status === 200 && response.data?.status === 'ok') {
        return response.data.obfuscated_email || response.data.contact_point || '-'
      }
    } catch (error) { return '-' }
    return '-'
  }

  getMonetizationStatus(data) {
    const followers = data.follower_count || 0
    const posts = data.media_count || 0
    const isPrivate = data.is_private || true
    return (followers >= 50 && posts >= 0 && !isPrivate) ? '✅ Elegible' : '❌ No Elegible'
  }

  estimateYear(pk) {
    try {
      const pkNum = parseInt(pk)
      const ranges = [[1, 5000000, 2010], [5000001, 17750000, 2011], [17750001, 279760000, 2012], [279760001, 900990000, 2013], [900990001, 1629010000, 2014], [1629010001, 2369359761, 2015], [2369359762, 4239516754, 2016], [4239516755, 6345108209, 2017], [6345108210, 10016232395, 2018], [10016232396, 27238602159, 2019], [27238602160, 43464475395, 2020], [43464475395, 50289297647, 2021], [50289297647, 57464707082, 2022], [57464707082, 63313426938, 2023], [63313426938, 70134323896, 2024], [70313426938, 78313496938, 2025]]
      for (const [low, high, year] of ranges) {
        if (pkNum >= low && pkNum <= high) return String(year)
      }
    } catch (error) { return 'Desconocido' }
    return '2023+'
  }
}

const instagramChecker = new InstagramChecker()

export default {
  command: ['igr', 'ig'],
  cost: 2,
  exec: async ({ sock, msg, from, args, sender }) => {
    let username = args.join(' ').trim()
    if (username.startsWith('@')) username = username.slice(1)
    
    if (!username) {
      await sock.sendMessage(from, { text: '⚠️ *Formato incorrecto*\n\nUsa el comando así:\n*.igr <username>*' }, { quoted: msg })
      return false
    }

    const msgCarga = await sock.sendMessage(from, { text: `🔍 *SOSI CODEX* | Consultando Instagram...\n⏳ Buscando información de *@${username}*`, mentions: [sender] }, { quoted: msg })

    try {
      const userId = await instagramChecker.getUserIdFromUsername(username)
      if (!userId) throw new Error('Usuario no encontrado')

      const userData = await instagramChecker.getUserData(userId)
      if (!userData) throw new Error('No se pudieron obtener los datos')

      const email = `${username}@gmail.com`
      const emailExists = await instagramChecker.checkEmail(email)
      const resetMask = await instagramChecker.fetchResetEmail(username)
      const year = instagramChecker.estimateYear(userData.pk || 0)
      const monetization = instagramChecker.getMonetizationStatus(userData)

      const mensaje = `╔═══════════════════════════════╗
║   🔍 *INSTAGRAM CHECKER* 🔍   ║
╚═══════════════════════════════╝

👤 *Nombre:* ${userData.full_name || '-'}
🏷️ *Username:* @${userData.username}
📧 *Email:* ${email}
🌐 *Dominio:* ${email.split('@')[1] || 'gmail.com'}
👥 *Seguidores:* ${(userData.follower_count || 0).toLocaleString()}
🔄 *Siguiendo:* ${(userData.following_count || 0).toLocaleString()}
📸 *Posts:* ${userData.media_count || 0}
📅 *Año estimado:* ${year}
💬 *Bio:* ${(userData.biography || '-').slice(0, 50)}
🔒 *Reset Mask:* ${resetMask}
💰 *Monetización:* ${monetization}
📧 *Email existe:* ${emailExists ? '✅ Sí' : '❌ No'}

🔗 *Perfil:* https://instagram.com/${userData.username}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *SOSI CODEX* | Instagram Tool`

      if (msgCarga?.key) await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      await sock.sendMessage(from, { text: mensaje, mentions: [sender] }, { quoted: msg })
      return true // Indica éxito para el descuento de créditos
    } catch (error) {
      console.error('Error en igr:', error.message)
      if (msgCarga?.key) await sock.sendMessage(from, { delete: msgCarga.key }).catch(() => {})
      await sock.sendMessage(from, { text: `❌ *Error*\n\nNo se pudo obtener la información de *@${username}*.\n\nVerifica que el usuario exista o intenta más tarde.`, mentions: [sender] }, { quoted: msg })
      return false
    }
  }
}