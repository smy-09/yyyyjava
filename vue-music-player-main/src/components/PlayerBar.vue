<template>
  <footer class="player">
    <div class="p-left">
      <div class="cover" :style="cur >= 0 ? coverStyle(cur) : ''"></div>
      <div class="meta">
        <div class="t">{{ cur >= 0 && state.songs[cur] ? state.songs[cur].title : '—' }}</div>
        <div class="a">{{ cur >= 0 && state.songs[cur] ? state.songs[cur].artist : '—' }}</div>
      </div>
    </div>

    <div class="p-center">
      <div class="controls">
        <button class="btn" title="上一首" @click="player.prev()">⏮</button>
        <button class="btn play" title="播放/暂停" @click="player.toggle()">
          {{ state.playing ? '⏸' : '▶' }}
        </button>
        <button class="btn" title="下一首" @click="player.next()">⏭</button>
      </div>

      <div class="progress">
        <span class="time">{{ fmt(state.curTime) }}</span>
        <div class="bar" @click="onSeek">
          <div class="fill" :style="{ width: pct + '%' }"></div>
          <div class="knob" :style="{ left: pct + '%' }"></div>
        </div>
        <span class="time">{{ fmt(cur >= 0 && state.songs[cur] ? state.songs[cur].dur : 0) }}</span>
      </div>
    </div>

    <div class="p-right">
      <div class="mode" title="播放模式" @click="player.cycleMode()">{{ modeNames[state.mode] }}</div>
      <div class="vol">
        🔊
        <div class="bar" @click="onVol">
          <div class="fill" :style="{ width: state.volume * 100 + '%' }"></div>
          <div class="knob" :style="{ left: state.volume * 100 + '%' }"></div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { state, coverStyle, fmt } from '../store'
import { player } from '../utils/player'

const modeNames = ['顺序', '随机', '单曲']
const cur = computed(() => state.current)

const pct = computed(() => {
  const curSong = cur.value >= 0 ? state.songs[cur.value] : null
  const total = state.duration || (curSong ? curSong.dur : 0)
  if (!total) return 0
  return Math.min(100, (state.curTime / total) * 100)
})

function ratioOf(e) {
  const r = e.currentTarget.getBoundingClientRect()
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
}

function onSeek(e) {
  player.seek(ratioOf(e))
}

function onVol(e) {
  player.setVolume(ratioOf(e))
}
</script>
