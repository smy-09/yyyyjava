# 酷狗音乐 Web Player（Vue 3 版）

由单文件 `index.html` 改造而来的 Vue 3 工程，样式全部拆到独立的 `.css` 文件中。

## 快速开始

```bash
npm install     # 安装依赖（国内建议加 --registry=https://registry.npmmirror.com）
npm run dev     # 启动开发服务器，默认 http://localhost:5173
npm run build   # 打包到 dist/
npm run preview # 预览打包结果
```

## 目录结构

```
vue-music-player/
├─ index.html                 入口 HTML
├─ package.json
├─ vite.config.js
└─ src/
   ├─ main.js                 应用入口，统一引入所有 CSS
   ├─ App.vue                 根组件：登录页 / 主界面切换
   ├─ store.js                全局响应式状态（reactive + actions，相当于轻量 Pinia）
   ├─ data/
   │  └─ songs.js             歌曲、歌词、预设头像 / 背景数据
   ├─ utils/
   │  ├─ player.js            单例 Audio + 播放控制
   │  └─ image.js             图片压缩、时间格式化
   ├─ styles/                 ★ 所有样式（原本内联在 HTML 里）
   │  ├─ variables.css        CSS 变量（颜色 / 圆角）
   │  ├─ base.css             重置、背景层、滚动条、Toast
   │  ├─ login.css            登录页
   │  ├─ register.css         注册页（在登录页样式上扩展）
   │  ├─ layout.css           顶栏、侧边栏、内容区、横幅
   │  ├─ songlist.css         歌曲列表
   │  ├─ profile.css          个人资料、外观设置
   │  ├─ nowplaying.css       正在播放面板、唱片、歌词
   │  └─ player.css           底部播放条
   └─ components/
      ├─ LoginPage.vue        登录（无账号不可进入，无跳过入口）
      ├─ RegisterPage.vue     注册（字段校验 / 密码强度 / 图形验证码 / 协议弹窗）
      ├─ TopBar.vue           顶栏 + 搜索
      ├─ SideBar.vue          侧边导航
      ├─ HomeView.vue         推荐页
      ├─ FavView.vue          我喜欢
      ├─ ProfileView.vue      个人资料（v-model 表单）
      ├─ ThemeView.vue        外观设置（头像 / 背景）
      ├─ SongList.vue         歌曲列表（被首页和收藏页复用）
      ├─ NowPlaying.vue       唱片 + 歌词
      ├─ PlayerBar.vue        底部播放控制
      └─ Toast.vue            轻提示
```

## 功能

- 登录 / 注册：
  - 未登录时在「登录页 ↔ 注册页」之间切换，注册成功后自动回到登录页并回填用户名
  - 注册页含完整前端校验：用户名格式与重名检测、手机号选填校验、密码长度与字符组成、确认密码一致性、图形验证码、协议勾选
  - 密码强度实时评估（弱 / 中 / 强），字段级错误提示 + 整卡抖动反馈，提交时自动滚动到首个错误项
  - 图形验证码为 canvas 本地生成（4 位，去除易混淆字符），点击可换一张
  - 协议 / 隐私政策为弹窗阅读，未勾选不允许提交
  - **不开放游客访问**：账号不存在、密码错误都拒绝进入，也没有「跳过」入口，必须先注册
  - 本机还没有任何账号时，登录页会给出引导并禁用「进入」按钮；刷新保持登录态（会话中的账号必须仍在本地账号库中）
- 个人资料：昵称 / 性别 / 生日 / 城市 / 邮箱 / 签名，v-model 双向绑定，保存后写入 localStorage
- 更换头像：8 个预设 + 本地上传（自动压缩到 256px）
- 更换背景：6 套预设渐变 + 本地上传（压缩到 1440px）
- 播放器：播放 / 暂停、上下首、进度拖拽、音量、顺序 / 随机 / 单曲、搜索、收藏
- 歌词随播放进度高亮并自动滚动

## 说明

- 歌曲使用的是免费示例音频，需要联网才能播放
- 个人资料、头像、背景保存在浏览器 localStorage，换浏览器或清缓存会丢失
- 注册的账号保存在 localStorage 的 `kg_users_v1` 键中（口令只存不可逆摘要，不存明文），**仅供演示**：真实项目必须由服务端完成注册、校验与加盐哈希存储
