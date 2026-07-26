# 内容包接口

Web 界面按顺序加载：

1. `course-data.js` → `window.QURAN_APP_DATA`
2. `alphabet-data.js` → `window.QURAN_ALPHABET_DATA`
3. `pronunciation-data.js` → `window.QURAN_PRONUNCIATION_DATA`

仓库中的文件是安全占位符，不包含生产课程。

完整内容包至少需要：

- `QURAN_APP_DATA.meta.reviewIntervals`
- `QURAN_APP_DATA.lessons`
- `QURAN_APP_DATA.schedule`
- `QURAN_APP_DATA.pronunciationDays`
- `QURAN_ALPHABET_DATA.groups`
- `QURAN_ALPHABET_DATA.letters`
- `QURAN_ALPHABET_DATA.specialForms`
- `QURAN_ALPHABET_DATA.joiningRules`
- `QURAN_ALPHABET_DATA.articulationZones`
- `QURAN_ALPHABET_DATA.contrastGroups`
- `QURAN_PRONUNCIATION_DATA.pronunciations`
- `QURAN_PRONUNCIATION_DATA.entryForms`

内容包提交前必须完成来源和再分发许可核验。

