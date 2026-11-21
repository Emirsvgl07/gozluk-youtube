// Gözlük YouTube: Meta Ray-Ban Display için YouTube web uygulaması.
// Giriş modeli: yön tuşları (Neural Band kaydırma) odak taşır, Enter (pinch) seçer,
// Escape / sistem Geri bir önceki ekrana döner.
import { CONFIG } from './config.js';

const root = document.getElementById('root');
const hasKey = Boolean(CONFIG.apiKey && CONFIG.apiKey.trim());
const API = 'https://www.googleapis.com/youtube/v3';

// ---------- Yardımcılar ----------

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : String(kid));
  }
  return el;
}

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* depolama dolu veya kapalı: sessizce geç */
    }
  },
};

// API başlıkları HTML kaçışlı gelir (&#39; vb.).
function decode(s) {
  const t = document.createElement('textarea');
  t.innerHTML = s ?? '';
  return t.value;
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

function focusInitial(container, key) {
  const el =
    (key && container.querySelector(`[data-key="${CSS.escape(key)}"]`)) ||
    container.querySelector('button, input');
  el?.focus();
}

const thumb = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/default.jpg`;

// ---------- Veri ----------

async function ytApi(path, params, signal) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries({ ...params, key: CONFIG.apiKey })) {
    url.searchParams.set(k, v);
  }
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`YouTube API hatası (${r.status})`);
  return r.json();
}

async function searchVideos(q, signal) {
  const d = await ytApi(
    '/search',
    {
      part: 'snippet',
      type: 'video',
      maxResults: 10,
      q,
      regionCode: CONFIG.region,
      relevanceLanguage: 'tr',
      videoEmbeddable: 'true',
      safeSearch: 'moderate',
    },
    signal,
  );
  return d.items
    .filter((i) => i.id?.videoId)
    .map((i) => ({
      id: i.id.videoId,
      title: decode(i.snippet.title),
      channel: decode(i.snippet.channelTitle),
    }));
}

async function trendingVideos(signal) {
  const d = await ytApi(
    '/videos',
    { part: 'snippet', chart: 'mostPopular', regionCode: CONFIG.region, maxResults: 10 },
    signal,
  );
  return d.items.map((i) => ({ id: i.id, title: i.snippet.title, channel: i.snippet.channelTitle }));
}

// Anahtarsız başlık bilgisi: YouTube oEmbed (CORS açık). Sonuçlar önbelleğe alınır.
async function videoInfo(ids, signal) {
  const cache = store.get('yt-titles', {});
  const out = await Promise.all(
    ids.map(async (id) => {
      if (cache[id]) return { id, ...cache[id] };
      try {
        const u = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
          'https://www.youtube.com/watch?v=' + id,
        )}`;
        const r = await fetch(u, { signal });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        cache[id] = { title: j.title, channel: j.author_name };
        return { id, ...cache[id] };
      } catch (e) {
        if (signal.aborted) throw e;
        return { id, title: `Video ${id}`, channel: 'Bilgi alınamadı' };
      }
    }),
  );
  store.set('yt-titles', cache);
  return out;
}

function addHistory(v) {
  const list = store.get('yt-history', []).filter((x) => x.id !== v.id);
  list.unshift(v);
  store.set('yt-history', list.slice(0, 30));
}

// ---------- Yönlendirme (tarayıcı geçmişi = sistem Geri) ----------

let cleanup = null;
let screenAbort = null;

function show(state) {
  cleanup?.();
  cleanup = null;
  screenAbort?.abort();
  screenAbort = new AbortController();
  root.replaceChildren();
  cleanup = screens[state.screen]?.(state, screenAbort.signal) || null;
}

function go(state) {
  // Geri dönünce aynı düğmeye odaklanmak için mevcut odağı kaydet.
  const cur = history.state;
  if (cur) history.replaceState({ ...cur, focus: document.activeElement?.dataset?.key }, '');
  history.pushState(state, '');
  show(state);
}

window.addEventListener('popstate', (e) => show(e.state || { screen: 'home' }));

// Masaüstü testi: sahiplenilmemiş Escape = Geri.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (history.state?.screen && history.state.screen !== 'home') {
    e.preventDefault();
    history.back();
  }
});

// Yön tuşlarıyla uzamsal odak: ekrandaki konuma göre en yakın düğmeye geç.
// Gözlükte ve masaüstü tarayıcıda aynı davranır. Tarayıcının kendi gezinmesiyle
// çift adım olmaması için varsayılan davranış engellenir.
function moveFocus(dir) {
  const cands = [...root.querySelectorAll('button, input')].filter(
    (el) => !el.disabled && el.getClientRects().length,
  );
  if (!cands.length) return;
  const cur = document.activeElement;
  if (!cands.includes(cur)) {
    cands[0].focus();
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of cands) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const [main, cross] =
      dir === 'ArrowDown' ? [dy, dx] :
      dir === 'ArrowUp' ? [-dy, dx] :
      dir === 'ArrowRight' ? [dx, dy] : [-dx, dy];
    if (main <= 1) continue;
    const score = main + Math.abs(cross) * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: 'nearest' });
  }
}

// window dinleyicisi document dinleyicilerinden sonra çalışır; ekranlar
// (ör. oynatıcıdaki ses kontrolü) bir tuşu önce sahiplenebilir.
window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || !e.key.startsWith('Arrow')) return;
  if (e.target instanceof HTMLInputElement && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
  e.preventDefault();
  moveFocus(e.key);
});

// ---------- Ekranlar ----------

function menuButton(label, key, onClick) {
  return h('button', { dataset: { key }, onClick }, label);
}

function renderHome(state) {
  const body = h('div', { class: 'scroll' });

  if (hasKey) {
    const input = h('input', {
      type: 'search',
      placeholder: '🔍 Ara (yaz veya söyle)',
      'aria-label': "YouTube'da ara",
      enterkeyhint: 'search',
      dataset: { key: 'search' },
    });
    let last = '';
    const submit = () => {
      const q = input.value.trim();
      if (!q || q === last) return;
      last = q;
      go({ screen: 'list', kind: 'search', q, title: `“${q}”` });
    };
    input.addEventListener('change', submit);
    body.append(
      h('form', { role: 'search', onSubmit: (e) => { e.preventDefault(); submit(); } }, input),
      menuButton("🔥 Türkiye'de trend", 'trend', () =>
        go({ screen: 'list', kind: 'trend', title: 'Trend' }),
      ),
    );
  }

  if (store.get('yt-history', []).length) {
    body.append(
      menuButton('🕘 Son izlenenler', 'history', () =>
        go({ screen: 'list', kind: 'history', title: 'Son izlenenler' }),
      ),
    );
  }

  CONFIG.lists.forEach((l, i) => {
    const key = `list${i}`;
    if (l.playlistId) {
      body.append(
        menuButton(`▶︎ ${l.title}`, key, () =>
          go({ screen: 'player', list: l.playlistId, title: l.title }),
        ),
      );
    } else if (l.videos?.length) {
      body.append(
        menuButton(`📺 ${l.title}`, key, () =>
          go({ screen: 'list', kind: 'videos', ids: l.videos, title: l.title }),
        ),
      );
    }
  });

  if (!hasKey) {
    body.append(h('p', { class: 'note' }, 'Arama için config.js dosyasına YouTube API anahtarı ekle.'));
  }

  root.append(h('h1', {}, 'YouTube'), body);
  focusInitial(body, state.focus);
}

function videoRow(v, key, onClick) {
  return h(
    'button',
    { class: 'vrow', dataset: { key }, onClick, 'aria-label': `${v.title}, ${v.channel}` },
    h('img', { src: thumb(v.id), alt: '', width: 120, height: 90, loading: 'lazy' }),
    h('span', {}, h('span', { class: 't' }, v.title), h('span', { class: 'c' }, v.channel)),
  );
}

function loadItems(state, signal) {
  switch (state.kind) {
    case 'search': return searchVideos(state.q, signal);
    case 'trend': return trendingVideos(signal);
    case 'history': return Promise.resolve(store.get('yt-history', []));
    case 'videos': return videoInfo(state.ids, signal);
    default: return Promise.resolve([]);
  }
}

function renderList(state, signal) {
  const box = h('div', { class: 'scroll' });
  const status = h('p', { class: 'status', role: 'status' }, 'Yükleniyor…');
  root.append(h('h1', {}, state.title), status, box);

  loadItems(state, signal)
    .then((items) => {
      if (signal.aborted) return;
      if (!items.length) {
        status.textContent = 'Sonuç yok.';
        return;
      }
      status.remove();
      const ids = items.map((x) => x.id);
      items.forEach((v, i) =>
        box.append(
          videoRow(v, `v${i}`, () =>
            go({ screen: 'player', ids, index: i, title: v.title }),
          ),
        ),
      );
      focusInitial(box, state.focus);
    })
    .catch((err) => {
      if (signal.aborted) return;
      status.textContent = `Yüklenemedi: ${err.message}`;
      const retry = menuButton('Tekrar dene', 'retry', () => show(history.state));
      box.append(retry);
      retry.focus();
    });
}

// YouTube IFrame API yalnızca oynatıcı açılınca, bir kez yüklenir.
let ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => {
        ytApiPromise = null;
        reject(new Error('YouTube yüklenemedi'));
      };
      document.head.append(s);
    });
  }
  return ytApiPromise;
}

const ERRORS = {
  2: 'Geçersiz video',
  5: 'Video oynatılamadı',
  100: 'Video bulunamadı',
  101: 'Bu video gömülü oynatmaya kapalı',
  150: 'Bu video gömülü oynatmaya kapalı',
};

function renderPlayer(state) {
  const title = h('p', { class: 'vtitle' }, state.title || '');
  const time = h('span', { class: 'time' }, '0:00 / 0:00');
  const fill = h('div', { class: 'fill' });
  const toast = h('p', { class: 'toast', role: 'status' });

  let player = null;
  let ready = false;
  let destroyed = false;
  let lastId = null;
  let timer = null;
  let toastTimer = null;
  let volume = store.get('yt-volume', 80);

  const say = (msg, ms = 2000) => {
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('on'), ms);
  };
  const call = (fn) => {
    if (ready && !destroyed) fn(player);
  };

  const btn = (label, aria, key, fn) =>
    h('button', { class: 'ctl', 'aria-label': aria, dataset: { key }, onClick: fn }, label);

  const playBtn = btn('▶︎', 'Oynat', 'play', () =>
    call((p) => (p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo())),
  );
  const setPlayIcon = (playing) => {
    playBtn.textContent = playing ? '⏸︎' : '▶︎';
    playBtn.setAttribute('aria-label', playing ? 'Duraklat' : 'Oynat');
  };

  root.append(
    h('div', { class: 'video' }, h('div', { id: 'yt' })),
    h('div', { class: 'meta' }, title, h('div', { class: 'prog' }, h('div', { class: 'bar' }, fill), time)),
    h(
      'div',
      { class: 'rail' },
      btn('⏮︎', 'Önceki video', 'prev', () => call((p) => p.previousVideo())),
      btn('−10', '10 saniye geri', 'back', () =>
        call((p) => p.seekTo(Math.max(0, p.getCurrentTime() - 10), true)),
      ),
      playBtn,
      btn('+10', '10 saniye ileri', 'fwd', () =>
        call((p) => p.seekTo(p.getCurrentTime() + 10, true)),
      ),
      btn('⏭︎', 'Sonraki video', 'next', () => call((p) => p.nextVideo())),
    ),
    toast,
  );
  playBtn.focus();

  const tick = () =>
    call((p) => {
      const cur = p.getCurrentTime() || 0;
      const dur = p.getDuration() || 0;
      time.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
      fill.style.width = dur ? `${Math.min(100, (cur / dur) * 100)}%` : '0';
    });
  const startTimer = () => {
    if (!timer) timer = setInterval(tick, 1000);
  };
  const stopTimer = () => {
    clearInterval(timer);
    timer = null;
  };

  // Yukarı/aşağı = ses. Sağ/sol düğmeler arasında odak taşır.
  const onKey = (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    volume = Math.max(0, Math.min(100, volume + (e.key === 'ArrowUp' ? 10 : -10)));
    store.set('yt-volume', volume);
    call((p) => {
      p.unMute();
      p.setVolume(volume);
    });
    say(`🔊 Ses %${volume}`);
  };

  // Gözlük uykuya geçince / uygulama arka plana alınınca duraklat.
  const onVisibility = () => {
    if (document.hidden) {
      call((p) => p.pauseVideo());
      stopTimer();
    } else {
      startTimer();
    }
  };

  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);

  loadYouTubeApi()
    .then((YT) => {
      if (destroyed) return;
      player = new YT.Player('yt', {
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          origin: location.origin,
        },
        events: {
          onReady: (e) => {
            if (destroyed) return;
            ready = true;
            const iframe = e.target.getIframe();
            iframe.tabIndex = -1;
            iframe.setAttribute('aria-hidden', 'true');
            e.target.setVolume(volume);
            if (state.list) {
              e.target.loadPlaylist({ list: state.list, listType: 'playlist', index: 0 });
            } else {
              e.target.loadPlaylist(state.ids, state.index || 0);
            }
            startTimer();
            // Otomatik oynatma engellenirse kullanıcıya söyle.
            setTimeout(() => call((p) => {
              if (p.getPlayerState() !== 1 && p.getPlayerState() !== 3) say('Oynatmak için ▶ düğmesine bas', 3000);
            }), 3500);
          },
          onStateChange: (e) => {
            const playing = e.data === 1;
            setPlayIcon(playing);
            if (!playing) return;
            const d = e.target.getVideoData?.();
            if (d?.video_id && d.video_id !== lastId) {
              lastId = d.video_id;
              if (d.title) title.textContent = d.title;
              addHistory({ id: d.video_id, title: d.title || d.video_id, channel: d.author || '' });
            }
          },
          onError: (e) => {
            say(ERRORS[e.data] || 'Oynatma hatası', 2500);
            setTimeout(() => call((p) => p.nextVideo()), 2500);
          },
        },
      });
    })
    .catch((err) => say(err.message, 4000));

  return () => {
    destroyed = true;
    stopTimer();
    clearTimeout(toastTimer);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    try {
      player?.destroy();
    } catch {
      /* zaten kapalı */
    }
  };
}

const screens = { home: renderHome, list: renderList, player: renderPlayer };

// ---------- Başlat ----------
if (!history.state?.screen) history.replaceState({ screen: 'home' }, '');
show(history.state);
