// Transports for co-op. PeerJS (WebRTC, vendored) for real play; BroadcastChannel for two-tab tests.
// Both expose: host(code), join(code), send(peerId|null, msg), close(); events: open, peer, message, leave, error.

class Emitter {
  constructor() { this.l = {}; }
  on(ev, fn) { (this.l[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.l[ev] || []) f(...a); }
}

let peerjsLoading = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!peerjsLoading) {
    peerjsLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = new URL('../../vendor/peerjs/peerjs.min.js', import.meta.url).href;
      s.onload = () => (window.Peer ? res(window.Peer) : rej(new Error('PeerJS failed to load')));
      s.onerror = () => rej(new Error('PeerJS failed to load'));
      document.head.appendChild(s);
    });
  }
  return peerjsLoading;
}

const hostId = (code) => `mtp-crew-${code.toLowerCase()}`;

export class PeerTransport extends Emitter {
  constructor() { super(); this.conns = new Map(); this.peer = null; this.isHost = false; this.id = null; }

  async host(code) {
    const Peer = await loadPeerJS();
    this.isHost = true;
    return new Promise((res, rej) => {
      const p = new Peer(hostId(code), { debug: 0 });
      this.peer = p;
      p.on('open', (id) => { this.id = id; this.emit('open', id); res(id); });
      p.on('connection', (c) => this.adopt(c));
      p.on('error', (e) => { this.emit('error', e); rej(e); });
      p.on('disconnected', () => { try { p.reconnect(); } catch { /* gone */ } });
    });
  }

  async join(code) {
    const Peer = await loadPeerJS();
    this.isHost = false;
    return new Promise((res, rej) => {
      const p = new Peer(undefined, { debug: 0 });
      this.peer = p;
      p.on('open', (id) => {
        this.id = id;
        const c = p.connect(hostId(code), { reliable: true, serialization: 'json' });
        const to = setTimeout(() => rej(new Error('The crew host did not answer.')), 12000);
        c.on('open', () => { clearTimeout(to); this.adopt(c); this.emit('open', id); res(id); });
        c.on('error', (e) => { clearTimeout(to); rej(e); });
      });
      p.on('error', (e) => { this.emit('error', e); rej(e); });
    });
  }

  adopt(c) {
    const add = () => { this.conns.set(c.peer, c); this.emit('peer', c.peer); };
    if (c.open) add(); else c.on('open', add);
    c.on('data', (d) => this.emit('message', c.peer, d));
    c.on('close', () => { this.conns.delete(c.peer); this.emit('leave', c.peer); });
    c.on('error', () => { this.conns.delete(c.peer); this.emit('leave', c.peer); });
  }

  send(to, msg) {
    if (to) { const c = this.conns.get(to); if (c && c.open) c.send(msg); return; }
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  close() {
    for (const c of this.conns.values()) try { c.close(); } catch { /* closed */ }
    this.conns.clear();
    if (this.peer) try { this.peer.destroy(); } catch { /* gone */ }
    this.peer = null;
  }
}

// Same contract over a BroadcastChannel: lets two tabs on one machine play a crew offline.
export class LocalTransport extends Emitter {
  constructor() { super(); this.id = `tab-${Math.random().toString(36).slice(2, 8)}`; this.peers = new Set(); this.isHost = false; this.ch = null; this.beat = null; }

  open(code) {
    this.ch = new BroadcastChannel(`mtp-coop-${code.toLowerCase()}`);
    this.ch.onmessage = (ev) => this.onMsg(ev.data);
    this.beat = setInterval(() => this.post({ t: '_ping' }), 1000);
    this.seen = new Map();
    // a closing tab says goodbye at once; silence only counts as gone after 40 s, because a busy tab (one
    // that is loading a crater) can stall its timers for a long while and must not be taken for gone
    this.bye = () => this.post({ t: '_bye' });
    addEventListener('pagehide', this.bye);
    this.watch = setInterval(() => {
      const now = Date.now();
      for (const [p, t] of this.seen) if (now - t > 40000) this.drop(p);
    }, 1000);
  }

  drop(p) { this.seen.delete(p); this.peers.delete(p); this.emit('leave', p); }

  async host(code) {
    this.isHost = true;
    this.open(code);
    this.emit('open', this.id);
    return this.id;
  }

  async join(code) {
    this.isHost = false;
    this.open(code);
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('No crew host answered on this machine. Open the host tab first.')), 4000);
      this.pendingJoin = () => { clearTimeout(to); this.emit('open', this.id); res(this.id); };
      this.post({ t: '_hello' });
    });
  }

  post(m, to = null) { this.ch && this.ch.postMessage({ from: this.id, to, host: this.isHost, m }); }

  onMsg({ from, to, host, m }) {
    if (from === this.id || (to && to !== this.id)) return;
    this.seen.set(from, Date.now());
    if (m.t === '_hello') {
      if (this.isHost) { this.peers.add(from); this.post({ t: '_welcome' }, from); this.emit('peer', from); }
      return;
    }
    if (m.t === '_welcome') {
      if (!this.isHost && host) { this.peers.add(from); this.hostPeer = from; if (this.pendingJoin) { this.pendingJoin(); this.pendingJoin = null; } this.emit('peer', from); }
      return;
    }
    if (m.t === '_ping') return;
    if (m.t === '_bye') { if (this.seen.has(from)) this.drop(from); return; }
    if (!this.peers.has(from)) {
      // only talk to members of this crew (host <-> members)
      if (this.isHost || host) { this.peers.add(from); }
      else return;
    }
    this.emit('message', from, m);
  }

  send(to, msg) {
    if (to) this.post(msg, to);
    else this.post(msg, this.isHost ? null : this.hostPeer);
  }

  close() {
    clearInterval(this.beat); clearInterval(this.watch);
    if (this.bye) { this.bye(); removeEventListener('pagehide', this.bye); this.bye = null; }
    if (this.ch) this.ch.close();
    this.ch = null;
    this.peers.clear();
  }
}

export function makeTransport(debug) { return debug ? new LocalTransport() : new PeerTransport(); }
