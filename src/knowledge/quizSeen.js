// Per-kid record of asked questions (save.quizSeen, most recent last) shared by every feature.
import {useGame} from '../game/store.js';
import {pickFromBank, shuffled, sameAsSeen, aiQuizId, similarBankIds} from './quizbank.js';
export const getSeen = () => useGame.getState().save?.quizSeen || [];
export function markSeen(...ids) {
  const add = ids.flat().filter(Boolean); if (!add.length) return;
  const cur = getSeen(); if (add.every(id=>cur.at(-1)===id || (cur.includes(id) && cur.lastIndexOf(id) >= cur.length-add.length))) return;
  useGame.getState().update(s=>{ s.quizSeen = [...(s.quizSeen||[]).filter(x=>!add.includes(x)), ...add].slice(-400); });
}
// An unseen bank question for a concept (shuffled), or null if the concept has no bank.
export function pickQuiz(cardId) { const q = pickFromBank(cardId, getSeen()); return q ? shuffled(q) : null; }
// Keep an AI-written quiz unless it repeats something this kid already saw; then swap in an unseen bank question.
export function freshQuiz(aiQuiz, cardId) {
  const seen = getSeen();
  if (aiQuiz && !seen.includes(aiQuizId(cardId, aiQuiz)) && !sameAsSeen(aiQuiz, cardId, seen)) return {...aiQuiz, id:aiQuizId(cardId, aiQuiz), alsoIds:similarBankIds(aiQuiz, cardId)};
  return pickQuiz(cardId) || (aiQuiz ? {...aiQuiz, id:aiQuizId(cardId, aiQuiz)} : null);
}
