// 全局响应式状态（一个轻量版的 Pinia：reactive + 一组 action）
import { reactive } from 'vue'
import { songs, palette, AVATARS, BGS, DEFAULT_BG, LYRICS } from './data/songs'
import { fmt } from './utils/image'

const STORE_KEY = 'kg_player_profile_v1'
const USERS_KEY = 'kg_users_v1'

/* ---------- 本地账号库（演示用：真实项目必须由后端完成注册与校验） ---------- */
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

// 深拷贝一份默认值，避免 fav / 对象等引用被多处共享后互相污染
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

export const state = reactive({
  logged: false,        // 是否已进入主界面
  authView: 'login',    // login / register（未登录时显示哪一页）
  loginPrefill: '',     // 注册成功后回填到登录页的用户名
  accounts: loadUsers(),// 本地注册账号列表
  view: 'home',         // home / fav / profile / theme
  profile: loadProfile(),
  filter: '',           // 搜索关键词
  current: -1,          // 当前歌曲下标
  playing: false,
  mode: 0,              // 0 顺序 1 随机 2 单曲
  curTime: 0,
  duration: 0,
  volume: 0.7,
  lyricIndex: 0,
  toastMsg: '',
  toastShow: false
})

let toastTimer = null

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

  // 未登录页切换：login / register
  showAuth(v) {
    state.authView = v === 'register' ? 'register' : 'login'
  },

  // 按用户名（不区分大小写）查找已注册账号
  findUser(name) {
    const n = String(name || '').trim().toLowerCase()
    if (!n) return null
    return state.accounts.find((u) => String(u.username).toLowerCase() === n) || null
  },

  // 注册：写入本地账号库
  register({ username, phone, password }) {
    const name = String(username || '').trim()
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

  // 必须用已注册账号登录：账号不存在、密码错误、信息不全都会拒绝进入
  login(name, pwd) {
    const n = String(name || '').trim()
    const p = String(pwd || '')

    if (!n && !p) return { ok: false, msg: '请输入账号和密码' }
    if (!n) return { ok: false, msg: '请输入账号' }
    if (!p) return { ok: false, msg: '请输入密码' }

    const user = actions.findUser(n)
    if (!user) {
      return { ok: false, msg: '该账号不存在，请先注册' }
    }
    if (digest(p) !== user.pwd) {
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

  logout() {
    try {
      sessionStorage.removeItem('kg_logged')
      sessionStorage.removeItem('kg_logged_user')
    } catch (e) {}
    state.logged = false
    state.view = 'home'
    state.authView = 'login'
    state.loginPrefill = ''
  },

  // 刷新后恢复登录态：会话中的账号必须仍存在于本机账号库，否则一律退回登录页
  autoLogin() {
    try {
      if (sessionStorage.getItem('kg_logged') !== '1') return false
      const user = actions.findUser(sessionStorage.getItem('kg_logged_user') || '')
      if (!user) {
        sessionStorage.removeItem('kg_logged')
        sessionStorage.removeItem('kg_logged_user')
        return false
      }
      state.profile.account = user.username
      return true
    } catch (e) {
      return false
    }
  },

  isFav(i) {
    return state.profile.fav.indexOf(i) > -1
  },

  toggleFav(i) {
    const k = state.profile.fav.indexOf(i)
    if (k > -1) {
      state.profile.fav.splice(k, 1)
      actions.toast('已取消收藏')
    } else {
      state.profile.fav.push(i)
      actions.toast('已加入我喜欢的音乐')
    }
    actions.save()
  },

  saveProfile() {
    if (!state.profile.nickname.trim()) {
      actions.toast('昵称不能为空')
      return
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
  }
}

/* ---------- 一些纯函数辅助 ---------- */
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

export { songs, AVATARS, BGS, LYRICS, fmt }
