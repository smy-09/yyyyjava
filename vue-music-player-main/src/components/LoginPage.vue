<template>
  <div class="login-mask">
    <div class="login-card" :class="{ shake: shaking }">
      <div class="lg-brand">
        <span class="mark">🎵</span>
        <span><b>酷狗</b>音乐</span>
      </div>

      <h1>欢迎回来</h1>
      <p class="login-sub">{{ subText }}</p>

      <!-- 模式提示：让用户知道数据存哪儿了 -->
      <div class="lg-mode" :class="state.online ? 'on' : 'off'">
        {{ state.online ? '🟢 已连接后端（数据存入 MySQL）' : '🟡 后端未连接（数据存本机浏览器）' }}
      </div>

      <!-- 本机还没有任何账号：给出明确引导，不提供任何绕过入口 -->
      <div class="lg-notice" v-if="!state.accounts.length && !allowEnter">
        <b>本机还没有账号</b>
        <span>请先注册一个账号，注册成功后才能登录使用</span>
      </div>

      <div class="lg-field">
        <label for="lg-user">账号<i class="req">*</i></label>
        <input
          id="lg-user"
          v-model.trim="user"
          type="text"
          maxlength="20"
          autocomplete="username"
          placeholder="请输入已注册的用户名"
          @keydown.enter="enter"
        />
      </div>
      <div class="lg-field">
        <label for="lg-pwd">密码<i class="req">*</i></label>
        <input
          id="lg-pwd"
          v-model="pwd"
          type="password"
          maxlength="20"
          autocomplete="current-password"
          placeholder="请输入密码"
          @keydown.enter="enter"
        />
      </div>

      <div class="lg-err">{{ err }}</div>

      <button class="lg-btn" @click="enter" :disabled="!allowEnter || submitting">
        {{ submitting ? '登 录 中…' : '进 入' }}
      </button>
      <button class="lg-ghost" @click="goRegister">
        {{ allowEnter ? '没有账号？注册一个 →' : '立即注册 →' }}
      </button>

      <div class="lg-tip">
        本播放器不开放游客访问：必须注册账号并登录后才能进入<br />
        {{ state.online ? '账号数据保存在后端 MySQL 数据库（music_player）中' : '账号信息仅保存在本机浏览器，请勿使用真实密码' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { actions, state } from '../store'

const user = ref('')
const pwd = ref('')
const err = ref('')
const shaking = ref(false)
const submitting = ref(false)

// 后端在线时，本机账号库可能是空的（账号在数据库里），
// 这种情况下不能因为「本地无账号」就禁用登录按钮。
const allowEnter = computed(() => state.online || state.accounts.length > 0)

const subText = computed(() => {
  if (state.online) return '请使用已注册的账号登录（数据来自后端数据库）'
  return state.accounts.length
    ? '本机已有 ' + state.accounts.length + ' 个账号，请登录或注册新账号'
    : '没有账号无法进入，请先完成注册'
})

// 注册成功后自动回填用户名
onMounted(() => {
  if (state.loginPrefill) {
    user.value = state.loginPrefill
    state.loginPrefill = ''
    const el = document.getElementById('lg-pwd')
    if (el && el.focus) el.focus()
  }
})

function shakeIt() {
  shaking.value = false
  requestAnimationFrame(() => {
    shaking.value = true
    setTimeout(() => (shaking.value = false), 420)
  })
}

async function enter() {
  if (submitting.value) return
  err.value = ''
  submitting.value = true
  // actions.login 现在是异步的（要请求后端）
  const res = await actions.login(user.value, pwd.value)
  submitting.value = false
  if (res && !res.ok) {
    err.value = res.msg
    shakeIt()
  }
}

function goRegister() {
  state.loginPrefill = user.value
  actions.showAuth('register')
}
</script>
