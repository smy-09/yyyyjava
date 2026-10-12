<template>
  <!-- 可更换的背景层 -->
  <div class="bg-layer" :style="{ background: bgStyle(state.profile.bg) }"></div>

  <!-- 未进入时只显示登录 / 注册页 -->
  <LoginPage v-if="!state.logged && state.authView === 'login'" />
  <RegisterPage v-else-if="!state.logged" />

  <!-- 主界面 -->
  <div class="app" v-else>
    <TopBar />
    <div class="layout">
      <SideBar />
      <main class="content">
        <HomeView v-if="state.view === 'home'" />
        <FavView v-else-if="state.view === 'fav'" />
        <ProfileView v-else-if="state.view === 'profile'" />
        <ThemeView v-else-if="state.view === 'theme'" />
      </main>
      <NowPlaying />
    </div>
    <PlayerBar />
  </div>

  <Toast />
</template>

<script setup>
import { onMounted } from 'vue'
import { state, actions, bgStyle } from './store'
import LoginPage from './components/LoginPage.vue'
import RegisterPage from './components/RegisterPage.vue'
import TopBar from './components/TopBar.vue'
import SideBar from './components/SideBar.vue'
import HomeView from './components/HomeView.vue'
import FavView from './components/FavView.vue'
import ProfileView from './components/ProfileView.vue'
import ThemeView from './components/ThemeView.vue'
import NowPlaying from './components/NowPlaying.vue'
import PlayerBar from './components/PlayerBar.vue'
import Toast from './components/Toast.vue'

// 启动流程：
//   1. bootstrap() 探测后端是否在线、拉取歌曲列表；
//   2. 再尝试恢复登录态（后端在线时会用 id 重新拉一次资料和收藏）。
// 后端没启动也不会白屏，会走本地 localStorage 兜底。
onMounted(async () => {
  await actions.bootstrap()
  if (state.logged) {
    state.logged = true
  }
  actions.toast(state.online ? '已连接后端服务' : '后端未连接，当前为本地演示模式')
})
</script>
