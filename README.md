# 古兰经阿拉伯语学习 App

[![Quality](https://github.com/hadiqaabu-ship-it/quran-arabic-learning-app/actions/workflows/quality.yml/badge.svg)](https://github.com/hadiqaabu-ship-it/quran-arabic-learning-app/actions/workflows/quality.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/hadiqaabu-ship-it/quran-arabic-learning-app?include_prereleases)](https://github.com/hadiqaabu-ship-it/quran-arabic-learning-app/releases)

一个面向中文学习者的离线优先古兰经阿拉伯语学习应用。项目包含 Web/PWA 学习界面和 Android WebView 容器，把词汇、完整经文语境、主动回忆、间隔复习和本地学习进度放在同一条学习路径中。

> 当前公开版：`v0.2.0-community`。仓库自带可直接运行的七日演示内容，发布音频文件数为 **0**。

## 现在可以直接体验什么

- 1 课完整展示全部 8 个学习词条，不设词库预览上限；
- 《忠诚章》112:1–4 的 4 节完整阿拉伯语经文；
- 7 天学习、巩固、经文定位和主动回忆安排；
- 4 个字母的发音部位、字形位置和辨形练习；
- 本地进度、收藏、复习和备份；
- PWA 离线框架和 Android 离线容器源码。

演示中的阿拉伯语经文是 Tanzil Quran Text v1.1 的逐字节选，中文为项目自编“学习释义”，不是经认证的宗教译本。完整来源和许可见 [docs/DEMO_CONTENT_LICENSES.md](docs/DEMO_CONTENT_LICENSES.md)。

## 为什么暂不发布音频

古兰经阿拉伯语原文、现代数字版本、译文、诵读表演和录音制品不是同一类权利。网页能播放或服务能生成音频，也不自动意味着可以把音频下载后放进 GitHub 或 APK 再分发。

因此本版本不包含任何诵读、单词、字母、语音合成或测试录音。无音频模式会自动隐藏发音导航、播放控件、听写入口和音频设置，其他学习功能可正常使用。边界与未来音频发布门槛见 [docs/CONTENT_BOUNDARIES.md](docs/CONTENT_BOUNDARIES.md)。

## 本地预览

在 `web/` 目录启动任意静态文件服务器并访问 `index.html`。例如：

```bash
cd web
python -m http.server 8000
```

然后打开 `http://127.0.0.1:8000/`。不要直接双击 HTML 文件测试 PWA 缓存。

## 自动验证

```bash
node --check web/app.js
node scripts/validate-community-content.mjs
```

验证脚本会核对课程计数、ID 引用、四节经文文本、中文学习释义标识、空音频映射和仓库零音频文件边界。GitHub Actions 会在每次推送和 Pull Request 中重复执行。

## Android 构建

1. 安装 Android Studio、Android SDK 35 和 JDK 17；
2. 使用 Android Studio 打开 `android/`，或在该目录运行 Gradle 构建；
3. 正式发布前使用自己的 release keystore 签名；
4. 达到 [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) 的移动发布门槛后再发布 APK。

仓库不提交个人 `local.properties`、密钥或构建产物，本次 GitHub Release 也不附 APK。

## 项目证据与治理

- 项目价值与证据边界：[docs/PROJECT_IMPACT.md](docs/PROJECT_IMPACT.md)
- 20 个内部迭代版本：[docs/DEVELOPMENT_HISTORY.md](docs/DEVELOPMENT_HISTORY.md)
- 架构说明：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 内容边界：[docs/CONTENT_BOUNDARIES.md](docs/CONTENT_BOUNDARIES.md)
- 第三方通知：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
- 路线图：[ROADMAP.md](ROADMAP.md)
- 版本记录：[CHANGELOG.md](CHANGELOG.md)
- 维护职责：[MAINTAINERS.md](MAINTAINERS.md)
- 安全政策：[SECURITY.md](SECURITY.md)

## 许可证与贡献

程序代码和项目原创演示内容按 [GNU GPL-3.0-only](LICENSE) 提供；Tanzil 经文节选继续受其 CC BY 3.0 条款约束。GPL 不会自动授予第三方音频、教材、翻译、字体或数据的权利。

欢迎提交代码、可访问性、离线体验、测试和文档改进。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。任何第三方内容贡献都必须先提供清晰的来源、版本和再分发许可。
