<template>
  <div class="login-mask reg-mask">
    <div class="login-card reg-card" :class="{ shake: shaking }">
      <div class="lg-brand">
        <span class="mark">🎵</span>
        <span><b>酷狗</b>音乐</span>
      </div>

      <h1>注册新账号</h1>
      <p class="login-sub">创建账号后，收藏与歌单才会被保存</p>

      <form class="reg-form" novalidate @submit.prevent="submit">
        <!-- 用户名 -->
        <div class="lg-field" :class="{ 'has-err': show('username') }">
          <label for="reg-user">用户名<i class="req">*</i></label>
          <input
            id="reg-user"
            v-model.trim="form.username"
            type="text"
            maxlength="20"
            autocomplete="username"
            placeholder="4-20 位，字母开头，可含数字与下划线"
            @blur="touch('username')"
          />
          <p class="fd-msg err" v-if="show('username')">{{ errors.username }}</p>
          <p class="fd-msg pass" v-else-if="pass('username')">✓ 该用户名可以使用</p>
        </div>

        <!-- 手机号 -->
        <div class="lg-field" :class="{ 'has-err': show('phone') }">
          <label for="reg-phone">手机号<i class="opt">选填</i></label>
          <input
            id="reg-phone"
            v-model.trim="form.phone"
            type="tel"
            maxlength="11"
            autocomplete="tel"
            placeholder="用于找回密码，也可稍后绑定"
            @blur="touch('phone')"
          />
          <p class="fd-msg err" v-if="show('phone')">{{ errors.phone }}</p>
          <p class="fd-msg pass" v-else-if="pass('phone')">✓ 手机号格式正确</p>
        </div>

        <!-- 密码 -->
        <div class="lg-field" :class="{ 'has-err': show('password') }">
          <label for="reg-pwd">设置密码<i class="req">*</i></label>
          <div class="in-wrap">
            <input
              id="reg-pwd"
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              maxlength="20"
              autocomplete="new-password"
              placeholder="8-20 位，需同时包含字母和数字"
              @blur="touch('password')"
            />
            <button
              type="button"
              class="in-eye"
              :aria-label="showPwd ? '隐藏密码' : '显示密码'"
              @click="showPwd = !showPwd"
            >
              {{ showPwd ? '🙈' : '👁' }}
            </button>
          </div>
          <div class="pw-meter" v-if="form.password">
            <span class="track"><i :class="'lv' + strength.level" :style="{ width: strength.pct + '%' }"></i></span>
            <b :class="'lv' + strength.level">强度：{{ strength.text }}</b>
          </div>
          <p class="fd-msg err" v-if="show('password')">{{ errors.password }}</p>
        </div>

        <!-- 确认密码 -->
        <div class="lg-field" :class="{ 'has-err': show('confirm') }">
          <label for="reg-pwd2">确认密码<i class="req">*</i></label>
          <div class="in-wrap">
            <input
              id="reg-pwd2"
              v-model="form.confirm"
              :type="showPwd ? 'text' : 'password'"
              maxlength="20"
              autocomplete="new-password"
              placeholder="请再次输入上面的密码"
              @blur="touch('confirm')"
            />
          </div>
          <p class="fd-msg err" v-if="show('confirm')">{{ errors.confirm }}</p>
          <p class="fd-msg pass" v-else-if="pass('confirm')">✓ 两次输入一致</p>
        </div>

        <!-- 图形验证码 -->
        <div class="lg-field" :class="{ 'has-err': show('captcha') }">
          <label for="reg-code">图形验证码<i class="req">*</i></label>
          <div class="in-wrap">
            <input
              id="reg-code"
              v-model.trim="form.captcha"
              type="text"
              maxlength="4"
              autocomplete="off"
              placeholder="不区分大小写"
              @blur="touch('captcha')"
            />
            <canvas
              ref="canvasRef"
              class="code-img"
              width="124"
              height="44"
              title="看不清？点击换一张"
              @click="refreshCaptcha"
            ></canvas>
          </div>
          <p class="fd-msg err" v-if="show('captcha')">{{ errors.captcha }}</p>
          <p class="fd-msg tip" v-else>看不清可点击图片换一张</p>
        </div>

        <!-- 协议 -->
        <label class="agree" :class="{ 'has-err': show('agree') }" for="reg-agree">
          <input id="reg-agree" v-model="form.agree" type="checkbox" @change="touch('agree')" />
          <span>
            我已阅读并同意
            <a href="#" @click.prevent.stop="openDoc('terms')">《用户服务协议》</a>与
            <a href="#" @click.prevent.stop="openDoc('privacy')">《隐私政策》</a>
          </span>
        </label>
        <p class="fd-msg err" v-if="show('agree')">{{ errors.agree }}</p>

        <button class="lg-btn reg-submit" type="submit" :disabled="submitting">
          {{ submitting ? '注 册 中…' : '注 册' }}
        </button>
        <button class="lg-ghost" type="button" @click="actions.showAuth('login')">已有账号？返回登录</button>

        <div class="lg-tip">
          注册信息保存在本机浏览器（localStorage），仅用于本演示项目<br />
          请勿使用真实密码，正式产品需由服务端完成校验与存储
        </div>
      </form>
    </div>

    <!-- 协议 / 隐私弹窗 -->
    <div class="lg-modal" v-if="doc" @click.self="doc = ''">
      <div class="lg-modal-box">
        <h3>{{ doc === 'terms' ? '用户服务协议' : '隐私政策' }}</h3>
        <div class="lg-modal-body">
          <p v-for="(line, i) in DOC_TEXT[doc]" :key="i">{{ line }}</p>
        </div>
        <button class="lg-btn" @click="doc = ''">我已知悉</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { actions, state } from '../store'

/* ---------- 表单数据 ---------- */
const form = reactive({
  username: '',
  phone: '',
  password: '',
  confirm: '',
  captcha: '',
  agree: false
})

const touched = reactive({
  username: false,
  phone: false,
  password: false,
  confirm: false,
  captcha: false,
  agree: false
})

const showPwd = ref(false)
const shaking = ref(false)
const submitting = ref(false)
const doc = ref('')

/* ---------- 图形验证码 ---------- */
// 去掉 0/O、1/I/l 等易混淆字符
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXY23456789'
const code = ref('')
const canvasRef = ref(null)

function drawCaptcha() {
  let s = ''
  for (let i = 0; i < 4; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]
  code.value = s

  const cv = canvasRef.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  const w = cv.width
  const h = cv.height

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.fillRect(0, 0, w, h)

  // 干扰线
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.06 + Math.random() * 0.1).toFixed(2) + ')'
    ctx.lineWidth = 1
    ctx.moveTo(Math.random() * w, Math.random() * h)
    ctx.lineTo(Math.random() * w, Math.random() * h)
    ctx.stroke()
  }

  // 字符
  const colors = ['#1ec8ff', '#7b5cff', '#8fe3ff', '#b7a6ff']
  s.split('').forEach((ch, i) => {
    ctx.save()
    ctx.translate(16 + i * 26, h / 2 + 8)
    ctx.rotate((Math.random() - 0.5) * 0.5)
    ctx.font = 'bold ' + (22 + Math.random() * 4).toFixed(0) + 'px "Segoe UI", Arial, sans-serif'
    ctx.fillStyle = colors[i % colors.length]
    ctx.fillText(ch, -8, 0)
    ctx.restore()
  })

  // 噪点
  for (let i = 0; i < 36; i++) {
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.05 + Math.random() * 0.16).toFixed(2) + ')'
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
}

function refreshCaptcha() {
  drawCaptcha()
  form.captcha = ''
  touched.captcha = false
}

onMounted(drawCaptcha)

/* ---------- 校验规则 ---------- */
const RULES = {
  username(v) {
    if (!v) return '请输入用户名'
    if (!/^[A-Za-z][A-Za-z0-9_]{3,19}$/.test(v)) {
      return '用户名需 4-20 位，字母开头，仅含字母、数字、下划线'
    }
    if (actions.findUser(v)) return '该用户名已被注册'
    return ''
  },
  phone(v) {
    if (!v) return ''
    if (!/^1[3-9]\d{9}$/.test(v)) return '请输入正确的 11 位手机号'
    return ''
  },
  password(v) {
    if (!v) return '请输入密码'
    if (v.length < 8 || v.length > 20) return '密码长度需 8-20 位'
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return '密码需同时包含字母和数字'
    return ''
  },
  confirm(v) {
    if (!v) return '请再次输入密码'
    if (v !== form.password) return '两次输入的密码不一致'
    return ''
  },
  captcha(v) {
    if (!v) return '请输入图形验证码'
    if (v.toUpperCase() !== code.value.toUpperCase()) return '验证码错误，请重新输入'
    return ''
  },
  agree(v) {
    return v ? '' : '请先阅读并同意用户服务协议与隐私政策'
  }
}

const errors = computed(() => ({
  username: RULES.username(form.username),
  phone: RULES.phone(form.phone),
  password: RULES.password(form.password),
  confirm: RULES.confirm(form.confirm),
  captcha: RULES.captcha(form.captcha),
  agree: RULES.agree(form.agree)
}))

function touch(k) {
  touched[k] = true
}

function show(k) {
  return touched[k] && !!errors.value[k]
}

function pass(k) {
  return touched[k] && !!form[k] && !errors.value[k]
}

/* ---------- 密码强度 ---------- */
const strength = computed(() => {
  const v = form.password
  if (!v) return { level: 0, pct: 0, text: '' }
  let score = 0
  if (v.length >= 8) score++
  if (/[A-Za-z]/.test(v) && /\d/.test(v)) score++
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) score++
  if (score <= 1) return { level: 1, pct: 33, text: '弱' }
  if (score === 2) return { level: 2, pct: 66, text: '中' }
  return { level: 3, pct: 100, text: '强' }
})

/* ---------- 提交 ---------- */
const FIELD_ORDER = ['username', 'phone', 'password', 'confirm', 'captcha', 'agree']
const FIELD_ID = {
  username: 'reg-user',
  phone: 'reg-phone',
  password: 'reg-pwd',
  confirm: 'reg-pwd2',
  captcha: 'reg-code',
  agree: 'reg-agree'
}

function shakeIt() {
  shaking.value = false
  requestAnimationFrame(() => {
    shaking.value = true
    setTimeout(() => (shaking.value = false), 420)
  })
}

function submit() {
  if (submitting.value) return

  FIELD_ORDER.forEach((k) => (touched[k] = true))

  const first = FIELD_ORDER.find((k) => errors.value[k])
  if (first) {
    shakeIt()
    actions.toast(errors.value[first])
    const el = document.getElementById(FIELD_ID[first])
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (first === 'captcha') refreshCaptcha()
    return
  }

  submitting.value = true
  // 模拟一次网络请求，让「注册中…」的状态可见
  setTimeout(() => {
    const res = actions.register({
      username: form.username,
      phone: form.phone,
      password: form.password
    })
    submitting.value = false

    if (!res.ok) {
      shakeIt()
      actions.toast(res.msg)
      touched.username = true
      return
    }

    actions.toast(res.msg)
    state.loginPrefill = res.username
    actions.showAuth('login')
  }, 500)
}

/* ---------- 协议文本（占位） ---------- */
const DOC_TEXT = {
  terms: [
    '一、服务说明：本项目为 Vue 3 学习演示用的音乐播放器，注册功能仅用于演示前端表单校验流程，不提供任何真实网络服务。',
    '二、账号说明：你注册的账号信息仅保存在本机浏览器的 localStorage 中，不会上传到任何服务器，也不会用于任何商业用途。',
    '三、使用规范：请勿在本页面填写任何真实的、重要的密码。由此产生的风险由使用者自行承担。',
    '四、条款变更：演示项目的条款可能随时调整，恕不另行通知。'
  ],
  privacy: [
    '一、收集范围：本页面仅收集你主动填写的用户名、手机号与密码（口令经不可逆摘要后存储于本机）。',
    '二、存储位置：全部数据保存在你本机浏览器的 localStorage 键 kg_users_v1 中，清除浏览器数据即会全部删除。',
    '三、信息共享：本项目不向任何第三方共享、传输或出售你的信息。',
    '四、你的权利：你可以在浏览器开发者工具中随时清除上述数据以注销账号。'
  ]
}

function openDoc(k) {
  doc.value = k
}
</script>
