// 全局响应式状态（一个轻量版的 Pinia：reactive + 一组 action）
//
// 【本次改造重点】所有账号 / 收藏 / 资料相关操作改为调用后端接口，
// 同时保留 localStorage 兜底：后端没启动时前端仍然能跑（纯本地模式）。
// 每条 action 都会先试后端，失败再落到本地，页面顶部会提示当前模式。
import { reactive } from 'vue'
import { songs as localSongs, palette, AVATARS, BGS, DEFAULT_BG, LYRICS as LOCAL_LYRICS } from './data/songs'
import { fmt } from './utils/image'
import { api, pingBackend, setCurrentUserId } from './utils/request'

const STORE_KEY = 'kg_player_profile_v1'
const USERS_KEY = 'kg_users_v1'

/* ============================================================
   一、本地兜底存储（后端不可用时使用）
   ============================================================ */

function loadUsers() {
  try {
    const arr = JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    return []
  }
}

function saveUsers(list) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list))
    return true
  } catch (e) {
    return false
  }
}

// 口令摘要：仅做不可逆混淆，避免明文落地；不是安全哈希，正式项目须由后端加盐处理
function digest(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0
  return 'kg1$' + h.toString(16)
}

export const DEFAULT_PROFILE = {
  nickname: '音乐旅人',
  desc: '今天也想听点好听的 ♪',
  gender: 'secret',
  birthday: '',
  city: '',
  email: '',
  account: '',
  avatar: '',
  bg: '',
  fav: [],
  playCount: 0
}

function freshDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PROFILE))
}

function loadProfile() {
  try {
    return Object.assign(freshDefaults(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}'))
  } catch (e) {
    return freshDefaults()
  }
}

/* ============================================================
   二、全局状态
   ============================================================ */

export const state = reactive({
  logged: false, // 是否已进入主界面
  authView: 'login', // login / register（未登录时显示哪一页）
  loginPrefill: '', // 注册成功后回填到登录页的用户名
  accounts: loadUsers(), // 本地注册账号列表（同时用于「重名检测」的快速判断）
  view: 'home', // home / fav / profile / theme
  profile: loadProfile(),
  filter: '', // 搜索关键词
  current: -1, // 当前歌曲下标
  playing: false,
  mode: 0, // 0 顺序 1 随机 2 单曲
  curTime: 0,
  duration: 0,
  volume: 0.7,
  lyricIndex: 0,
  toastMsg: '',
  toastShow: false,

  /* ---------- 新增：后端接入相关 ---------- */
  userId: null, // 后端返回的用户主键
  online: false, // 后端是否可用（false 表示走本地兜底）
  songs: localSongs, // 歌曲列表，后端可用时会被接口数据替换
  lyrics: LOCAL_LYRICS // 歌词，后端可用时会被接口数据替换
})

let toastTimer = null

/* ============================================================
   三、action
   ============================================================ */

export const actions = {
  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.profile))
    } catch (e) {
      actions.toast('浏览器存储不可用，本次修改仅在当前页面有效')
    }
  },

  toast(msg) {
    state.toastMsg = msg
    state.toastShow = true
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (state.toastShow = false), 2000)
  },

  showView(v) {
    state.view = v
  },

  showAuth(v) {
    state.authView = v === 'register' ? 'register' : 'login'
  },

  /* ---------------- 初始化：探测后端 + 拉取歌曲 ---------------- */

  /**
   * 应用启动时调用。
   * 1. 探测后端是否在线；
   * 2. 在线则拉歌曲列表（失败自动回退到本地歌曲数据）；
   * 3. 再尝试恢复登录态。
   */
  async bootstrap() {
    state.online = await pingBackend()

    if (state.online) {
      try {
        const list = await api.listSongs()
        if (Array.isArray(list) && list.length) {
          // 后端字段 -> 前端字段（duration 对前端是 dur）
          state.songs = list.map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            src: s.src,
            cover: s.cover,
            dur: s.duration
          }))
        }
      } catch (e) {
        // 保留本地歌曲，不打扰用户
      }
    }

    actions.autoLogin()
  },

  /* ---------------- 重名检测 ---------------- */

  /**
   * 用户名是否已存在。
   * 后端在线时问后端（权威），离线时查本地账号库。
   * 注意：注册页的校验函数是同步的，所以这里用「本地先行 + 后端异步纠正」的策略：
   * 同步返回本地的判断结果，同时后台请求后端，若发现后端已存在则通过回调提示。
   */
  findUser(name) {
    const n = String(name || '').trim().toLowerCase()
    if (!n) return null
    return state.accounts.find((u) => String(u.username).toLowerCase() === n) || null
  },

  /** 供注册页调用：异步问后端用户名是否被占用 */
  async checkUsernameOnline(name) {
    if (!state.online) return false
    try {
      return await api.exists(String(name || '').trim())
    } catch (e) {
      return false
    }
  },

  /* ---------------- 注册 ---------------- */

  async register({ username, phone, password }) {
    const name = String(username || '').trim()

    if (state.online) {
      try {
        await api.register({
          username: name,
          phone: String(phone || '').trim(),
          password: String(password || '')
        })
        // 后端注册成功，同时记一份到本地，方便离线时也能看到账号提示
        state.accounts = state.accounts.concat({
          username: name,
          phone: String(phone || '').trim()
        })
        saveUsers(state.accounts)
        return { ok: true, username: name, msg: '注册成功，请使用新账号登录' }
      } catch (e) {
        // 后端明确返回的业务错误（如重名）直接透出，不做本地兜底
        return { ok: false, msg: e.message || '注册失败' }
      }
    }

    /* ----- 后端不可用：本地注册（原逻辑） ----- */
    if (actions.findUser(name)) {
      return { ok: false, msg: '该用户名已被注册' }
    }
    const user = {
      username: name,
      phone: String(phone || '').trim(),
      pwd: digest(String(password || '')),
      createdAt: new Date().toISOString()
    }
    const next = state.accounts.concat(user)
    if (!saveUsers(next)) {
      return { ok: false, msg: '浏览器存储不可用，注册失败' }
    }
    state.accounts = next
    return { ok: true, username: name, msg: '注册成功，请使用新账号登录' }
  },

  /* ---------------- 登录 ---------------- */

  async login(name, pwd) {
    const n = String(name || '').trim()
    const p = String(pwd || '')

    if (!n && !p) return { ok: false, msg: '请输入账号和密码' }
    if (!n) return { ok: false, msg: '请输入账号' }
    if (!p) return { ok: false, msg: '请输入密码' }

    if (state.online) {
      try {
        const user = await api.login({ username: n, password: p })
        state.userId = user.id
        setCurrentUserId(user.id)
        actions.applyUser(user)

        // 收藏也一起拉下来
        try {
          const favIds = await api.listFavorites(user.id)
          state.profile.fav = (favIds || []).map((id) => actions.indexOfSong(id)).filter((i) => i >= 0)
        } catch (e) {
          /* 收藏拉取失败不影响登录 */
        }

        actions.save()
        state.logged = true
        state.authView = 'login'
        try {
          sessionStorage.setItem('kg_logged', '1')
          sessionStorage.setItem('kg_logged_user', user.username)
          sessionStorage.setItem('kg_logged_id', String(user.id))
        } catch (e) {}
        actions.toast('欢迎回来，' + user.username)
        return { ok: true }
      } catch (e) {
        return { ok: false, msg: e.message || '登录失败' }
      }
    }

    /* ----- 后端不可用：本地登录（原逻辑） ----- */
    const user = actions.findUser(n)
    if (!user) {
      return { ok: false, msg: '该账号不存在，请先注册' }
    }
    if (user.pwd && digest(p) !== user.pwd) {
      return { ok: false, msg: '密码错误，请重新输入' }
    }

    state.profile.account = user.username
    actions.save()
    state.logged = true
    state.authView = 'login'
    try {
      sessionStorage.setItem('kg_logged', '1')
      sessionStorage.setItem('kg_logged_user', user.username)
    } catch (e) {}
    actions.toast('欢迎回来，' + user.username)
    return { ok: true }
  },

  /** 把后端返回的用户信息映射到 state.profile */
  applyUser(user) {
    if (!user) return
    state.profile.account = user.username || ''
    if (user.nickname) state.profile.nickname = user.nickname
    if (user.gender) state.profile.gender = user.gender
    if (user.birthday) state.profile.birthday = user.birthday
    if (user.city) state.profile.city = user.city
    if (user.email) state.profile.email = user.email
    // 后端字段 signature -> 前端 desc
    if (user.signature != null) state.profile.desc = user.signature
    if (user.avatar) state.profile.avatar = user.avatar
    if (user.background) state.profile.bg = user.background
    if (typeof user.playCount === 'number') state.profile.playCount = user.playCount
  },

  /** 按歌曲 id 找它在当前列表里的下标（找不到返回 -1） */
  indexOfSong(songId) {
    return state.songs.findIndex((s) => s.id === songId)
  },

  /** 取当前下标对应的歌曲 id */
  songIdAt(index) {
    const s = state.songs[index]
    return s && s.id != null ? s.id : null
  },

  /* ---------------- 退出 ---------------- */

  logout() {
    try {
      sessionStorage.removeItem('kg_logged')
      sessionStorage.removeItem('kg_logged_user')
      sessionStorage.removeItem('kg_logged_id')
    } catch (e) {}
    state.logged = false
    state.view = 'home'
    state.authView = 'login'
    state.loginPrefill = ''
    state.userId = null
    setCurrentUserId(null)
  },

  /** 刷新后恢复登录态 */
  async autoLogin() {
    try {
      if (sessionStorage.getItem('kg_logged') !== '1') return false
      const username = sessionStorage.getItem('kg_logged_user') || ''
      const id = sessionStorage.getItem('kg_logged_id')

      if (state.online && id) {
        // 后端在线：按 id 重新拉一次资料，保证多端数据一致
        const user = await api.getUser(Number(id))
        state.userId = user.id
        setCurrentUserId(user.id)
        actions.applyUser(user)
        try {
          const favIds = await api.listFavorites(user.id)
          state.profile.fav = (favIds || []).map((x) => actions.indexOfSong(x)).filter((i) => i >= 0)
        } catch (e) {}
        return true
      }

      // 离线：只要会话里的账号还在本地账号库里就放行
      const user = actions.findUser(username)
      if (!user) {
        sessionStorage.removeItem('kg_logged')
        sessionStorage.removeItem('kg_logged_user')
        return false
      }
      state.profile.account = user.username
      return true
    } catch (e) {
      // 后端查不到（比如账号被删了），退回登录页
      try {
        sessionStorage.removeItem('kg_logged')
        sessionStorage.removeItem('kg_logged_user')
        sessionStorage.removeItem('kg_logged_id')
      } catch (e2) {}
      return false
    }
  },

  /* ---------------- 收藏 ---------------- */

  isFav(i) {
    return state.profile.fav.indexOf(i) > -1
  },

  async toggleFav(i) {
    const k = state.profile.fav.indexOf(i)

    if (state.online && state.userId) {
      const songId = actions.songIdAt(i)
      if (songId != null) {
        try {
          const res = await api.toggleFavorite(state.userId, songId)
          if (res && res.favorited) {
            if (k === -1) state.profile.fav.push(i)
            actions.toast('已加入我喜欢的音乐')
          } else {
            if (k > -1) state.profile.fav.splice(k, 1)
            actions.toast('已取消收藏')
          }
          actions.save()
          return
        } catch (e) {
          actions.toast(e.message || '收藏失败')
          return
        }
      }
    }

    /* ----- 本地兜底 ----- */
    if (k > -1) {
      state.profile.fav.splice(k, 1)
      actions.toast('已取消收藏')
    } else {
      state.profile.fav.push(i)
      actions.toast('已加入我喜欢的音乐')
    }
    actions.save()
  },

  /* ---------------- 个人资料 ---------------- */

  async saveProfile() {
    if (!state.profile.nickname.trim()) {
      actions.toast('昵称不能为空')
      return
    }

    if (state.online && state.userId) {
      try {
        const user = await api.updateProfile({
          nickname: state.profile.nickname,
          gender: state.profile.gender,
          birthday: state.profile.birthday || null,
          city: state.profile.city,
          email: state.profile.email,
          signature: state.profile.desc,
          avatar: state.profile.avatar,
          background: state.profile.bg
        })
        actions.applyUser(user)
        actions.save()
        actions.toast('资料已保存到服务器')
        return
      } catch (e) {
        actions.toast(e.message || '保存失败')
        return
      }
    }

    actions.save()
    actions.toast('资料已保存')
  },

  resetProfile() {
    const keep = {
      fav: state.profile.fav.slice(),
      playCount: state.profile.playCount,
      account: state.profile.account
    }
    Object.assign(state.profile, freshDefaults(), keep)
    actions.save()
    actions.toast('已恢复默认资料')
  },

  setAvatar(id) {
    state.profile.avatar = id
    actions.save()
    actions.toast('头像已更换')
  },

  setBg(id) {
    state.profile.bg = id
    actions.save()
    const b = BGS.find((x) => x.id === id)
    actions.toast(b ? '背景已更换为「' + b.name + '」' : '背景已更新')
  },

  /* ---------------- 歌词 ---------------- */

  /** 播放次数同步给后端（静默失败，不打扰用户） */
  addPlayCountSilently(userId) {
    api.addPlayCount(userId).catch(() => {})
  },

  /** 按歌曲下标加载歌词（后端在线时拉接口，否则用本地歌词） */
  async loadLyric(index) {
    if (!state.online) {
      state.lyrics = LOCAL_LYRICS
      return
    }
    const songId = actions.songIdAt(index)
    if (songId == null) return
    try {
      const lines = await api.listLyric(songId)
      if (Array.isArray(lines) && lines.length) {
        state.lyrics = lines
        state.lyricIndex = 0
      }
    } catch (e) {
      state.lyrics = LOCAL_LYRICS
    }
  }
}

/* ============================================================
   四、纯函数辅助（与原实现保持一致）
   ============================================================ */

export function coverStyle(i) {
  const c = palette[i % palette.length]
  return 'background:linear-gradient(135deg,' + c[0] + ',' + c[1] + ')'
}

export function avatarBg(id) {
  if (id && id.indexOf('data:') === 0) return 'url(' + id + ') center/cover no-repeat'
  const p = AVATARS.find((a) => a.id === id) || AVATARS[0]
  return p.css
}

export function avatarText(id) {
  if (id && id.indexOf('data:') === 0) return ''
  const p = AVATARS.find((a) => a.id === id) || AVATARS[0]
  return p.t
}

export function bgStyle(b) {
  if (b && b.indexOf('data:') === 0) return 'url(' + b + ') center/cover no-repeat'
  if (b) {
    const p = BGS.find((x) => x.id === b)
    return p ? p.css : DEFAULT_BG
  }
  return DEFAULT_BG
}

// 兼容原有引用：songs / LYRICS 改为从 state 读取（响应式），
// 这里保留导出名，避免一次性改一堆组件。
export { palette, AVATARS, BGS, DEFAULT_BG, fmt }
export const songs = localSongs
export const LYRICS = LOCAL_LYRICS
