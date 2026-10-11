// Replace only external services. Application modules are imported unchanged.
const authURL = new URL('../../src/net/auth.js', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') {
    return {url: new URL('./cloudflare-stub.mjs', import.meta.url).href, shortCircuit: true};
  }
  const resolved = await nextResolve(specifier, context);
  if (resolved.url === authURL) return {...resolved, url: new URL('./auth-stub.mjs', import.meta.url).href};
  return resolved;
}
