// Global open/close for the flipbook: openFlipbook({cardId|topic|bey|moment}) from anywhere,
// and mount <FlipbookHost onUnlock={...}/> once near the app root.
import {create} from 'zustand';
export const useFlipbook = create(set=>({start:null, open:start=>set({start:{...start, _t:Date.now()}}), close:()=>set({start:null})}));
export const openFlipbook = start => useFlipbook.getState().open(start||{});
export const closeFlipbook = () => useFlipbook.getState().close();
