// 配音台词的匹配键：去掉 emoji、空白和省略号，避免显示用的符号影响匹配。
export const voKey = t => String(t || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/[\s…▍]/g, '').trim();
