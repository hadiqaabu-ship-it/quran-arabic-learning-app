# 架构说明

## 总体结构

```text
Content package
  ├─ course-data.js
  ├─ alphabet-data.js
  └─ pronunciation-data.js
          ↓
Web/PWA learning UI
  ├─ localStorage progress
  ├─ IndexedDB recordings
  ├─ Service Worker cache
  └─ import/export backup
          ↓
Android WebView container
  ├─ offline app.local origin
  ├─ microphone permission bridge
  └─ Downloads backup bridge
```

## Web/PWA

`web/app.js` 包含学习状态、课程与词库渲染、主动回忆、经文练习、发音录音和备份逻辑。学习进度保存在 `localStorage`，录音保存在 `IndexedDB`。Service Worker 只缓存公开仓库中存在的应用外壳。

## Android

Android 工程将同一套 Web 文件打包到 `app/src/main/assets/app/`，并通过受限的 `https://app.local/` 离线来源加载。容器只开放必要的录音权限、本地备份保存和系统窗口适配。

## 内容包边界

程序代码和学习内容分离。公开仓库使用占位数据文件，避免未经授权的教材、翻译和音频被错误再分发。内容包必须提供课程、字母和发音三个全局对象，字段说明见 `web/data/README.md`。

## 安全与隐私

- 不需要云端账号；
- 默认不上传学习进度或录音；
- Android WebView 拒绝非 `app.local` 的资源请求；
- 导入数据会经过状态归一化；
- 公开自动检查拒绝常见密钥、受限媒体和大文件。

## 已知技术债务

- 课程天数和总词数仍有部分固定展示值；
- 内容包缺少正式 JSON Schema；
- 自动化测试目前侧重语法和仓库边界，尚未覆盖完整交互；
- Android release 签名和可复现构建流程尚待社区化。
