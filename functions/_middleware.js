// Cloudflare Pages Function: phones get the plain page at the main address.
//
// The sine page is made for a computer's screen. When a phone asks for the home page ("/"), this sends it the plain page
// (boring/index.html) instead, under the same address, so a shared link to sanoj.dev works for everyone. Computers, tablets and
// every other address (data, scripts, fonts, /boring/, /blog/) are passed on untouched. It only runs for "/" (see _routes.json,
// which dist/ gets from scripts/lib/dist.js), so it stays far below the free plan's limit.
const PHONE = /iPhone|iPod|Android.+Mobile|Windows Phone|Opera Mini|BlackBerry|IEMobile|Mobile.+Firefox/i;

export async function onRequest({ request, env, next }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  const mobile = request.headers.get('Sec-CH-UA-Mobile') === '?1' || PHONE.test(request.headers.get('User-Agent') || '');
  const res = mobile ? await env.ASSETS.fetch(new URL('/boring/', request.url)) : await next();
  const out = new Response(res.body, res);
  out.headers.set('Vary', 'User-Agent, Sec-CH-UA-Mobile'); // the answer depends on the phone, so caches must keep them apart
  return out;
}
