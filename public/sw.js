const CACHE_NAME = "pos-shell-v1";
const IMAGE_CACHE = "pos-images-v1";
const SHELL_URLS = ["/pos"];

/**
 * Mot cho duy nhat quyet dinh moi duong dan di duong nao. Tach ra thanh ham
 * thuan de test duoc ma khong can moi truong service worker.
 */
function routeFor(pathname) {
  if (pathname.startsWith("/api/")) return "skip";
  if (pathname.startsWith("/admin")) return "skip";
  if (pathname.startsWith("/uploads/")) return "image";
  if (pathname.startsWith("/pos")) return "shell";
  return "skip";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = [CACHE_NAME, IMAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !keep.includes(key))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

/** Network-first: man hinh ban phai moi, nhung mat mang thi lay ban cache. */
function shellStrategy(request) {
  return fetch(request)
    .then((response) => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached ?? Response.error()),
    );
}

/**
 * Cache-first: anh bat bien — ten file theo uuid, sua anh nghia la file moi.
 * Da co trong cache thi khong bao gio can hoi lai mang.
 */
function imageStrategy(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;

    return fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches
            .open(IMAGE_CACHE)
            .then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => Response.error());
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const route = routeFor(new URL(event.request.url).pathname);
  if (route === "skip") return;

  event.respondWith(
    route === "image"
      ? imageStrategy(event.request)
      : shellStrategy(event.request),
  );
});
