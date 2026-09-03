if (typeof window === 'undefined') {
  // ==========================================
  // SERVICE WORKER CONTEXT
  // ==========================================
  const CACHE_NAME = 'vfs-site-cache-v1';

  self.addEventListener('install', (event) => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    let requestToFetch = event.request;

    // 1. Virtual File System (VFS) Interception
    if (url.pathname.startsWith('/vfs/')) {
      
      // EXCEPTION: Reroute relative service worker requests to the server root
      if (url.pathname.endsWith('coi-serviceworker.js') || url.pathname.endsWith('sw.js')) {
        const scriptName = url.pathname.split('/').pop();
        requestToFetch = new Request('/' + scriptName, requestToFetch);
      } else {
        // Standard VFS cache lookup
        event.respondWith(
          caches.open(CACHE_NAME).then(async (cache) => {
            const matchedResponse = await cache.match(event.request, { ignoreSearch: true });
            if (matchedResponse) {
              return matchedResponse;
            }
            return new Response(
              `<h1>404 - VFS File Not Found</h1><p>Path: ${url.pathname}</p>`,
              { status: 404, headers: { 'Content-Type': 'text/html' } }
            );
          })
        );
        return;
      }
    }

    // 2. Cross-Origin-Isolation (COI) & Freshness for all other requests
    if (requestToFetch.cache === 'only-if-cached' && requestToFetch.mode !== 'same-origin') return;

    event.respondWith(
      fetch(requestToFetch, { cache: 'no-store' }).then((response) => {
        if (response.status === 0) return response;
        
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
        newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
        newHeaders.set('Cache-Control', 'no-store');
        
        // Allow the SW to control the root scope even if the request originated from /vfs/
        if (url.pathname.startsWith('/vfs/') && (url.pathname.endsWith('coi-serviceworker.js') || url.pathname.endsWith('sw.js'))) {
           newHeaders.set('Service-Worker-Allowed', '/');
        }
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      })
    );
  });

} else {
  // ==========================================
  // PAGE CONTEXT (Standalone Registration)
  // ==========================================
  (async () => {
    if (window.crossOriginIsolated !== false) return; 
    if (!navigator.serviceWorker) return; 
    
    try {
      const scriptSrc = document.currentScript ? document.currentScript.src.split('/').pop() : 'sw.js';
      await navigator.serviceWorker.register('/' + scriptSrc, { scope: '/' });
      
      if (sessionStorage.getItem('coiReloadedBySelf') !== 'true') {
        sessionStorage.setItem('coiReloadedBySelf', 'true');
        window.location.reload();
      } else {
        sessionStorage.removeItem('coiReloadedBySelf');
      }
    } catch (e) {
      console.warn('Service worker registration failed:', e);
    }
  })();
}