// 播放器：单例 Audio 元素 + 一组控制方法，状态同步回 store
import { state, actions } from '../store'

const audio = new Audio()
audio.volume = state.volume

function setPlaying(p) {
  state.playing = p
}

/** 当前播放列表（响应式：后端返回的歌曲会覆盖本地数据） */
function list() {
  return state.songs
}

export const player = {
  el: audio,

  play(i) {
    const songs = list()
    if (!songs[i]) return

    state.current = i
    state.profile.playCount++
    actions.save()

    // 顺便把播放次数同步给后端（失败不影响播放）
    if (state.online && state.userId) {
      actions.addPlayCountSilently(state.userId)
    }

    // 切歌时重新加载歌词
    actions.loadLyric(i)

    audio.src = songs[i].src
    const p = audio.play()
    if (p && p.then) {
      p.then(() => setPlaying(true)).catch(() => {
        setPlaying(true)
        actions.toast('音频加载中，请稍候…')
      })
    } else {
      setPlaying(true)
    }
  },

  toggle() {
    if (state.current < 0) {
      player.play(0)
      return
    }
    if (state.playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  },

  next() {
    const songs = list()
    if (state.current < 0) {
      player.play(0)
      return
    }
    if (state.mode === 2) {
      audio.currentTime = 0
      audio.play()
      return
    }
    const i = state.mode === 1 ? Math.floor(Math.random() * songs.length) : (state.current + 1) % songs.length
    player.play(i)
  },

  prev() {
    const songs = list()
    if (state.current < 0) {
      player.play(0)
      return
    }
    player.play((state.current - 1 + songs.length) % songs.length)
  },

  cycleMode() {
    state.mode = (state.mode + 1) % 3
    actions.toast('播放模式：' + ['顺序', '随机', '单曲'][state.mode])
  },

  seek(ratio) {
    if (!audio.duration) return
    audio.currentTime = ratio * audio.duration
  },

  setVolume(ratio) {
    audio.volume = ratio
    state.volume = ratio
  }
}

audio.addEventListener('timeupdate', () => {
  state.curTime = audio.currentTime
  state.duration = audio.duration || 0
  // 歌词行号：优先按后端歌词行数计算，没有歌词就不滚动
  const total = state.lyrics.length
  if (total > 0) {
    state.lyricIndex = Math.min(total - 1, Math.floor(audio.currentTime / 7))
  }
})

audio.addEventListener('ended', () => {
  if (state.mode !== 2) player.next()
  else {
    audio.currentTime = 0
    audio.play()
  }
})

audio.addEventListener('error', () => {
  if (state.current >= 0) actions.toast('音频加载失败，请检查网络连接')
})
