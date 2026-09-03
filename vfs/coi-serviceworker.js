// coi-serviceworker.js
// Basic service worker that adds the cross-origin-isolation response headers
// (COOP + COEP) to every response it serves. SharedArrayBuffer (needed by the
// pthread worker pool) requires self.crossOriginIsolated === true, which those
// two headers provide. Works on localhost / https; file:// cannot use SWs.
//
// 4jcraft: every response is fetched FRESH (cache: 'no-store') and served with
// Cache-Control: no-store. python -m http.server sends no validators, so the
// browser heuristic-caches Minecraft.Client.js/.wasm for ~10% of their age -
// after a rebuild that serves a STALE .js paired with the NEW .wasm, which
// dies in main() with "ASM_CONSTS[emAsmAddr] is not a function". Forcing
// fresh responses keeps js/wasm/data from the same build.
if (typeof window === 'undefined') {
  // Service worker context
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', (event) => {
    const r = event.request;
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;
    event.respondWith(
      fetch(r, { cache: 'no-store' }).then((response) => {
        if (response.status === 0) return response;
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
        newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
        newHeaders.set('Cache-Control', 'no-store');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      })
    );
  });
} else {
  // Page context (loaded by scripts/emshell.html's inline registration too):
  // standalone fallback registration for pages that include this file.
  (async () => {
    if (window.crossOriginIsolated !== false) return; // already isolated
    if (!navigator.serviceWorker) return; // not available (file:// etc.)
    try {
      await navigator.serviceWorker.register('coi-serviceworker.js');
      if (sessionStorage.getItem('coiReloadedBySelf') !== 'true') {
        sessionStorage.setItem('coiReloadedBySelf', 'true');
        window.location.reload();
      } else {
        sessionStorage.removeItem('coiReloadedBySelf');
      }
    } catch (e) {
      console.warn('coi-serviceworker registration failed:', e);
    }
  })();
}
