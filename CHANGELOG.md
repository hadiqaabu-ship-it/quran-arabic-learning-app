# 版本记录

本项目遵循 [Semantic Versioning](https://semver.org/)。

## [Unreleased]

- 继续完善可替换内容包的数据契约和验证工具。
- 增加自动化无障碍与离线回归检查。

## [0.2.0-community] - 2026-08-01

### Added

- 可直接运行的七日无音频演示包；
- 《忠诚章》112:1–4 四节完整阿拉伯语经文及来源许可记录；
- 1 课全部 8 个词条、4 个字母辨形示例和原创中文学习释义；
- 公开内容自动验证：计数、引用、经文文本和零音频边界；
- 20 个内部产品版本的诚实迭代记录和项目公共价值说明。

### Changed

- 课程天数、课数、词数和字母数改为由内容包动态决定；
- 课程详情直接展示本课全部词汇，不再要求跳转后才能查看完整词表；
- 无音频内容包自动隐藏发音导航、播放控件、听写入口和音频设置；
- 字母课程在无音频模式下直接进入辨形练习，不出现失效播放按钮；
- GitHub Actions 拒绝更多常见音频格式。

### Security

- 本版本发布的音频文件数为 0，且未发布 APK、签名材料、测试录音或内部日志。

## [0.1.0-community] - 2026-07-26

### Added

- Web/PWA 学习界面源码；
- Android 离线 WebView 容器；
- 课程、词库、经文语境、发音录音和本地备份相关程序逻辑；
- GPL-3.0-only 许可证、贡献指南和安全政策；
- 第三方内容与再分发边界；
- GitHub Actions 语法、受限媒体和大文件检查；
- 项目影响、架构、路线图和维护机制文档。

### Security

- 生产音频、教材 PDF、APK、签名材料、设备日志和个人学习数据不进入公开仓库。

[Unreleased]: https://github.com/hadiqaabu-ship-it/quran-arabic-learning-app/compare/v0.2.0-community...HEAD
[0.2.0-community]: https://github.com/hadiqaabu-ship-it/quran-arabic-learning-app/compare/v0.1.0-community...v0.2.0-community
[0.1.0-community]: https://github.com/hadiqaabu-ship-it/quran-arabic-learning-app/releases/tag/v0.1.0-community
