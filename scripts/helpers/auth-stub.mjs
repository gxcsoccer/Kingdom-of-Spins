let backend;
export const setAuthBackend = value => { backend = value; };
export const getSession = (...args) => backend.getSession(...args);
export const loadSave = (...args) => backend.loadSave(...args);
export const writeSave = (...args) => backend.writeSave(...args);
export const listKids = (...args) => backend.listKids(...args);
