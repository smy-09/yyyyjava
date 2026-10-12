/**
 * 后端接口封装。
 *
 * 设计要点：
 *  1. 统一走 /api 前缀，由 vite 的 proxy 转发到后端 8080，
 *     浏览器侧是同源请求，不需要处理跨域。
 *  2. 后端统一返回 { code, msg, data }，这里统一拆包：
 *     code === 200 时 resolve(data)，否则 reject(Error(msg))。
 *  3. 每个请求都带上 X-User-Id 头（从 store 里的当前用户取），
 *     这样「更新资料 / 收藏」这类接口不用把 userId 塞进 URL。
 *  4. 后端没起来时会抛错，调用方（store.js）据此降级到 localStorage，
 *     保证前端在后端挂了的情况下依然可用。
 */

/** 后端基地址：留空即可，因为 vite 已经配了 /api 代理 */
const BASE = ''

/** 当前登录用户 id，由 store.js 在登录成功时写入 */
let currentUserId = null

export function setCurrentUserId(id) {
  currentUserId = id
}

export function getCurrentUserId() {
  return currentUserId
}

/** 请求超时（毫秒）：后端没起时不要傻等 */
const TIMEOUT = 8000

/**
 * 底层请求方法。
 *
 * @param {string} path    以 /api 开头的路径
 * @param {object} options fetch 配置
 * @returns {Promise<any>} 直接返回业务 data
 */
async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  if (currentUserId != null) {
    headers['X-User-Id'] = String(currentUserId)
  }

  // 超时控制：AbortController 是浏览器原生能力，不用引第三方库
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const res = await fetch(BASE + path, {
      ...options,
      headers,
      signal: controller.signal
    })

    if (!res.ok) {
      throw new Error('HTTP ' + res.status)
    }

    const body = await res.json()

    if (body.code !== 200) {
      // 业务失败：把后端的提示语原样抛出去，页面直接展示
      const err = new Error(body.msg || '请求失败')
      err.code = body.code
      throw err
    }

    return body.data
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  /* ---------------- 用户 ---------------- */

  /** 注册：{ username, phone, password } -> { username } */
  register(payload) {
    return request('/api/user/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  /** 登录：{ username, password } -> 用户信息 */
  login(payload) {
    return request('/api/user/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  /** 用户名是否已存在 -> boolean */
  exists(username) {
    return request('/api/user/exists?username=' + encodeURIComponent(username))
  },

  /** 查询用户资料 */
  getUser(id) {
    return request('/api/user/' + id)
  },

  /** 更新个人资料（只传要改的字段） */
  updateProfile(patch) {
    return request('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(patch)
    })
  },

  /** 播放次数 +1 */
  addPlayCount(userId) {
    return request('/api/user/' + userId + '/play', { method: 'POST' })
  },

  /* ---------------- 歌曲 / 歌词 ---------------- */

  /** 歌曲列表，keyword 为空则返回全部 */
  listSongs(keyword) {
    const q = keyword ? '?keyword=' + encodeURIComponent(keyword) : ''
    return request('/api/song/list' + q)
  },

  /** 某首歌的歌词 -> string[] */
  listLyric(songId) {
    return request('/api/song/' + songId + '/lyric')
  },

  /* ---------------- 收藏 ---------------- */

  /** 某用户收藏的歌曲 id 列表 -> number[] */
  listFavorites(userId) {
    return request('/api/favorite/' + userId)
  },

  /** 切换收藏 -> { favorited: boolean } */
  toggleFavorite(userId, songId) {
    return request('/api/favorite/' + userId + '/toggle', {
      method: 'POST',
      body: JSON.stringify({ songId })
    })
  },

  /** 清空收藏 */
  clearFavorites(userId) {
    return request('/api/favorite/' + userId, { method: 'DELETE' })
  }
}

/**
 * 探测后端是否可用。
 * store.js 启动时调一次，决定走「后端模式」还是「本地兜底模式」。
 */
export async function pingBackend() {
  try {
    await request('/api/song/list')
    return true
  } catch (e) {
    return false
  }
}
