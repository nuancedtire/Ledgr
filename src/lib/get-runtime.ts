import type { AstroGlobal } from 'astro';

export function getRuntime(Astro: AstroGlobal | { locals: any }) {
  const runtime = (Astro.locals as any).runtime;
  if (!runtime?.env) {
    throw new Error('Cloudflare runtime not available');
  }
  return runtime.env as Env;
}
