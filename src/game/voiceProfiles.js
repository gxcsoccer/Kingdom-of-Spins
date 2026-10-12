// Public English Fish voices. Keep casting separate from the doctor's narrator.
// S2 delivery cues: https://docs.fish.audio/developer-guide/core-features/emotions
const young = '14d9d1c672dd4bf989489932f6e78467'; // Confident Young Male
const bright = '118460e4150a485db3d05521af49e3dd'; // Energetic Young Hero
const clear = '2fc438073798407ba40e3029a64ce159'; // Friendly Bilingual Female
const deep = 'bd29d925bc624243ba95084e4d88dab0'; // Movie trailer #1
export const CHARACTER_VOICES = {
  ran:    {reference:bright, cue:'confident', speed:1.02},
  tetsu:  {reference:young, cue:'calm', speed:.95},
  hop:    {reference:bright, cue:'excited', speed:1.06},
  raiga:  {reference:young, cue:'confident, clear articulation', speed:.96},
  hyomi:  {reference:clear, cue:'calm', speed:.95},
  iwaki:  {reference:deep, cue:'confident', speed:1},
  shadow: {reference:young, cue:'quiet, mysterious', speed:.94},
  blaze:  {reference:young, cue:'excited', speed:1.03},
  nova:   {reference:clear, cue:'confident, playful, clear articulation', speed:.96},
  ryuoh:  {reference:deep, cue:'confident, controlled, commanding', speed:.94},
};
const girls = new Set(['ran','hyomi','nova']);
const zh = {doctor:'ee18d36ee7bc4ab09f0533fa1e8e1ed0', boy:'2f0eb12d80d64f4b90fbfcf938b7f08d', girl:'f8b0c42a585d4dc6b012caec1bc58252'};
export const voiceRole = role => Object.hasOwn(CHARACTER_VOICES, role) ? role : 'doctor';
export function ttsPayload(text, role, locale, env = {}) {
  role = voiceRole(role);
  const character = CHARACTER_VOICES[role];
  const reference = locale === 'en'
    ? character ? env[`FISH_EN_${role.toUpperCase()}_VOICE_ID`] || character.reference : env.FISH_EN_VOICE_ID
    : zh[character ? girls.has(role) ? 'girl' : 'boy' : 'doctor'];
  if (!reference) return null;
  const expressive = locale === 'en' && character;
  return {
    text:expressive ? `[${character.cue}] ${text}` : text,
    reference_id:reference, format:'mp3', mp3_bitrate:128,
    ...(expressive ? {prosody:{speed:character.speed, normalize_loudness:true}} : {}),
  };
}
