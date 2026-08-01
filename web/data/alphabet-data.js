// Public no-audio alphabet demonstration content.
window.QURAN_ALPHABET_DATA = {
  meta: { version: "0.2.0-demo", status: "public-no-audio-demo", letterCount: 4, audioFileCount: 0 },
  groups: [
    { id: 1, title: "起步字母", subtitle: "先比较骨架与点位", letterIds: ["a01", "a02", "a03", "a04"], special: false },
  ],
  specialForms: [],
  joiningRules: [
    { title: "双向连接与单向连接", glyphs: "بـ ـبـ ـب   ا ـا", explanation: "ب、ت、ث 能向两侧连接；ا 只能与右侧前一个字母连接，不能继续连接左侧后一个字母。" },
  ],
  articulationZones: [
    { title: "口腔与双唇", subtitle: "观察舌位和唇形，同时记住点位。", letterIds: ["a01", "a02", "a03", "a04"] },
  ],
  contrastGroups: [
    { id: "dots-1", title: "同骨架不同点位", cue: "ب 是一点在下，ت 是两点在上，ث 是三点在上。", letterIds: ["a02", "a03", "a04"] },
  ],
  letters: [
    {
      id: "a01", order: 1, group: 1, letter: "ا", name: "أَلِف", category: "喉部起音与长音载体", joining: "right",
      forms: { isolated: "ا", initial: "ا", medial: "ـا", final: "ـا" },
      vowels: ["أَ", "إِ", "أُ"], vowelLabel: "开口、齐齿、合口",
      articulation: "作为带哈姆宰的起音时，声音从喉部开始；作为长音字母时延长前面的开口音。",
      mistake: "不要把所有 ا 都读成同一个短促音；先看它是否承担长音。",
      example: { word: "أَحَدٌ", meaning: "独一的" }, audio: {},
    },
    {
      id: "a02", order: 2, group: 1, letter: "ب", name: "بَاء", category: "双唇音", joining: "both",
      forms: { isolated: "ب", initial: "بـ", medial: "ـبـ", final: "ـب" },
      vowels: ["بَ", "بِ", "بُ"], vowelLabel: "开口、齐齿、合口",
      articulation: "双唇轻闭后放开，声音清楚但不额外加元音。",
      mistake: "不要读成汉语拼音 p，也不要在末尾加“呃”。",
      example: { word: "بِسْمِ", meaning: "奉……之名" }, audio: {},
    },
    {
      id: "a03", order: 3, group: 1, letter: "ت", name: "تَاء", category: "舌尖音", joining: "both",
      forms: { isolated: "ت", initial: "تـ", medial: "ـتـ", final: "ـت" },
      vowels: ["تَ", "تِ", "تُ"], vowelLabel: "开口、齐齿、合口",
      articulation: "舌尖接近上门齿根部，送出清晰、较薄的音。",
      mistake: "不要把 ت 读得过厚，也不要与 ط 混同。",
      example: { word: "تَبَّتْ", meaning: "已经毁灭" }, audio: {},
    },
    {
      id: "a04", order: 4, group: 1, letter: "ث", name: "ثَاء", category: "齿间音", joining: "both",
      forms: { isolated: "ث", initial: "ثـ", medial: "ـثـ", final: "ـث" },
      vowels: ["ثَ", "ثِ", "ثُ"], vowelLabel: "开口、齐齿、合口",
      articulation: "舌尖轻触或略伸出上下门齿之间，让气流从齿间通过。",
      mistake: "不要直接读成 s 或汉语“斯”；保留齿间摩擦。",
      example: { word: "ثُمَّ", meaning: "然后" }, audio: {},
    },
  ],
};
