# 内容包接口

本目录当前包含可运行的七日无音频演示包，而不是生产课程。来源与许可见 [`docs/DEMO_CONTENT_LICENSES.md`](../../docs/DEMO_CONTENT_LICENSES.md)。

界面按顺序加载：

1. `course-data.js` → `window.QURAN_APP_DATA`
2. `alphabet-data.js` → `window.QURAN_ALPHABET_DATA`
3. `pronunciation-data.js` → `window.QURAN_PRONUNCIATION_DATA`

内容包至少需要课程元数据、课程、日程、字母组、字母、连写规则、发音部位分组，以及一个可以为空的发音数据对象。课程天数、课程数、词数和字母数由数据动态决定。

本公开版本要求：

- `meta.audioFileCount` 为 `0`；
- `pronunciationDays` 和 `pronunciations` 为空；
- 每个词的 `audioTracks` 为空；
- 每个字母的 `audio` 映射为空；
- 仓库中不存在任何音频文件。

替换或扩展内容前，必须记录来源、版本、许可证、允许修改与再分发的范围，并更新自动验证与第三方通知。

