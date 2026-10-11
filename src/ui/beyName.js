// Display names: for the kid's own beys (they have a uid) the Chinese nickname comes first and the English
// name is the subtitle. Opponents' beys keep their own English names (their zh is inherited from the base bey).
const HAN = /[一-龥]/;
export const beyTitle = b => (b?.uid && b?.zh && HAN.test(b.zh) ? b.zh : b?.name) || '';
export const beySub = b => (beyTitle(b) !== b?.name ? b?.name || '' : '');
