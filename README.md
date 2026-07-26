# 古兰经阿拉伯语学习 App

一个面向中文学习者的离线优先阿拉伯语学习应用。项目包含 Web/PWA 学习界面和 Android WebView 容器，支持课程、词库、经文语境、发音练习、本地学习进度与备份。

## 开源范围

本仓库公开的是应用程序代码，不包含以下需要单独确认授权或重新制作的内容：

- 语音合成、朗读和古兰经诵读音频；
- 第三方教材、课程 PDF 及其扫描件；
- 未明确允许再分发的翻译、词表和课程数据；
- APK、签名文件、测试录音、设备日志和内部审核资料。

这是有意设置的版权边界，不是文件遗漏。完整说明见 [docs/CONTENT_BOUNDARIES.md](docs/CONTENT_BOUNDARIES.md)。

## 目录

```text
web/      Web/PWA 界面源码
android/  Android 离线容器源码
docs/     数据与发布边界说明
```

## 本地预览

`web/data/` 中的三个占位文件只负责提示“内容包未安装”。要运行完整学习功能，请按 [web/data/README.md](web/data/README.md) 提供自有或已获授权的数据。

在 `web/` 目录启动任意静态文件服务器后访问 `index.html`。不要直接双击 HTML 文件测试 PWA 缓存功能。

## Android 构建

1. 安装 Android Studio、Android SDK 35 和 JDK 17。
2. 将已经完成授权审查的 Web 内容包放入 `android/app/src/main/assets/app/`。
3. 在 `android/` 目录运行 Gradle 构建，或使用 Android Studio 打开该目录。
4. 正式发布前使用自己的 release keystore 签名；不要发布 debug 签名 APK。

当前 Android 工程没有提交个人 `local.properties`、密钥或构建产物。

## 许可证

程序代码采用 [GNU GPL-3.0-only](LICENSE)。

GPL 只覆盖本仓库中明确公开的程序代码，不自动授予任何第三方音频、教材、翻译、字体或数据内容的权利。贡献内容前请阅读 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 参与贡献

欢迎提交问题与改进。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [SECURITY.md](SECURITY.md)。

