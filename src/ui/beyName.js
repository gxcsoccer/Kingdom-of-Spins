import {translateText} from '../i18n/index.js';
// Owned tops prefer the player's chosen nickname in either language. Opponents keep their catalog name.
export const beyTitle = b => (b?.uid && b?.zh ? translateText(b.zh) : b?.name) || '';
export const beySub = b => (beyTitle(b) !== b?.name ? b?.name || '' : '');
