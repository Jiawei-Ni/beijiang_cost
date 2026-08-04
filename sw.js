/* 北疆行程 · Service Worker
   策略:app shell 全部预缓存 → 打开一次后彻底离线可用(禾木/喀纳斯没信号也能开)
   更新:改代码后把 CACHE 版本号 +1,用户下次联网打开会静默下载新版,再开一次生效
*/
var CACHE = 'beijiang-v9';
var ASSETS = [
  './',
  './index.html',
  './app.css',
  './data.js',
  './app.js',
  './sync.js',
  './ui.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // 逐个加,单个文件 404 不至于让整个 install 失败
      return Promise.all(ASSETS.map(function(u){
        return c.add(new Request(u, {cache:'reload'})).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k===CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;   // 外站请求不管

  // 页面导航:缓存优先(弱网下不会卡在超时上),后台悄悄更新
  if(req.mode === 'navigate'){
    // 只有「真的是 App 首页」才允许回写缓存。
    // 否则同目录下随便打开一个别的地址(带参数的分享链接、GitHub Pages 的 404 页……)
    // 都会被当成首页存进去,把离线用的 app shell 覆盖掉,下次断网打开就是一张错页。
    var shell = new URL('./index.html', self.location.href).pathname;
    var isShell = url.pathname === shell || /\/$/.test(url.pathname);
    e.respondWith(
      caches.match('./index.html').then(function(hit){
        var net = fetch(req).then(function(res){
          if(isShell && res && res.ok){
            var copy = res.clone();
            caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
          }
          return res;
        }).catch(function(){ return isShell ? hit : undefined; });
        return isShell ? (hit || net) : net.then(function(r){ return r || hit; });
      })
    );
    return;
  }

  // 静态资源:缓存优先,同时后台拉一次更新(stale-while-revalidate)
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
