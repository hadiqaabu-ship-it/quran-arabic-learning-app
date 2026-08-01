import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const context = vm.createContext({ window: {} });

for (const relativePath of ["web/data/course-data.js", "web/data/alphabet-data.js", "web/data/pronunciation-data.js"]) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  new vm.Script(source, { filename: relativePath }).runInContext(context);
}

const course = context.window.QURAN_APP_DATA;
const alphabet = context.window.QURAN_ALPHABET_DATA;
const pronunciation = context.window.QURAN_PRONUNCIATION_DATA;
const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };

assert(course && alphabet && pronunciation, "All three public data packages must load.");
assert(course.meta.audioMode === "none" && course.meta.audioFileCount === 0, "Course metadata must declare zero audio.");
assert(alphabet.meta.audioFileCount === 0, "Alphabet metadata must declare zero audio.");
assert(pronunciation.meta.audioFileCount === 0, "Pronunciation metadata must declare zero audio.");
assert(course.pronunciationDays.length === 0, "The no-audio release cannot contain pronunciation days.");
assert(pronunciation.pronunciations.length === 0 && Object.keys(pronunciation.entryForms).length === 0, "The no-audio release cannot contain pronunciation mappings.");

const words = course.lessons.flatMap((lesson) => lesson.words);
const verses = course.lessons.flatMap((lesson) => lesson.verses);
assert(words.length === course.meta.wordCount, "Word count metadata does not match the dataset.");
assert(verses.length === course.meta.verseCount, "Verse count metadata does not match the dataset.");
assert(course.lessons.length === course.meta.unitCount, "Lesson count metadata does not match the dataset.");
assert(course.schedule.length === course.meta.dayCount, "Schedule count metadata does not match the dataset.");
assert(new Set(words.map((word) => word.id)).size === words.length, "Word IDs must be unique.");
assert(new Set(verses.map((verse) => verse.id)).size === verses.length, "Verse IDs must be unique.");
assert(words.every((word) => Array.isArray(word.audioTracks) && word.audioTracks.length === 0), "Every public word must have an empty audioTracks array.");
assert(alphabet.letters.every((letter) => Object.values(letter.audio || {}).every((value) => !value)), "Alphabet audio mappings must be empty.");

const expectedVerses = new Map([
  ["112:1", "قُلْ هُوَ ٱللَّهُ أَحَدٌ"],
  ["112:2", "ٱللَّهُ ٱلصَّمَدُ"],
  ["112:3", "لَمْ يَلِدْ وَلَمْ يُولَدْ"],
  ["112:4", "وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ"],
]);
for (const verse of verses) {
  assert(expectedVerses.get(verse.reference) === verse.arabic, `Verse ${verse.reference} differs from the reviewed Tanzil excerpt.`);
  assert(verse.translation.startsWith("学习释义："), `Verse ${verse.reference} must identify the Chinese text as a learning gloss.`);
}

const wordIds = new Set(words.map((word) => word.id));
const verseIds = new Set(verses.map((verse) => verse.id));
for (const item of course.schedule) {
  assert(item.wordIds.every((id) => wordIds.has(id)), `Schedule day ${item.day} contains an unknown word ID.`);
  assert(item.verseIds.every((id) => verseIds.has(id)), `Schedule day ${item.day} contains an unknown verse ID.`);
  assert(!item.pronunciationDay, `Schedule day ${item.day} cannot enable pronunciation in a no-audio release.`);
}

const prohibitedExtensions = new Set([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".flac", ".opus", ".webm"]);
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git") return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
const audioFiles = walk(root).filter((file) => prohibitedExtensions.has(path.extname(file).toLowerCase()));
assert(audioFiles.length === 0, `Audio files are forbidden in this release: ${audioFiles.map((file) => path.relative(root, file)).join(", ")}`);

console.log(`Validated ${course.meta.dayCount} days, ${words.length} words, ${verses.length} complete verses, ${alphabet.letters.length} letters, and 0 audio files.`);
