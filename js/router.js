export class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.beforeEach = null;
    window.addEventListener('hashchange', () => this.resolve());
  }

  add(path, handler, meta = {}) {
    this.routes[path] = { handler, meta };
    return this;
  }

  resolve() {
    const hash = window.location.hash.slice(1) || '/';
    const parts = hash.split('/').filter(Boolean);

    let matched = this.routes[hash];
    let params = {};

    if (!matched) {
      for (const [path, route] of Object.entries(this.routes)) {
        const routeParts = path.split('/').filter(Boolean);
        if (routeParts.length !== parts.length) continue;
        let isMatch = true;
        const tempParams = {};
        for (let i = 0; i < routeParts.length; i++) {
          if (routeParts[i].startsWith(':')) {
            tempParams[routeParts[i].slice(1)] = parts[i];
          } else if (routeParts[i] !== parts[i]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) { matched = route; params = tempParams; break; }
      }
    }

    if (this.beforeEach) {
      const allowed = this.beforeEach(hash, matched?.meta);
      if (!allowed) return;
    }

    if (matched) {
      this.currentRoute = hash;
      matched.handler(params);
    } else {
      this.navigate('/login');
    }
  }

  navigate(path) {
    window.location.hash = path;
  }

  init() {
    this.resolve();
  }
}

export const router = new Router();
