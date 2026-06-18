/*!
 * Close AI — embeddable chat widget loader.
 * Usage on any website:
 *   <script src="https://close-ai-ai.vercel.app/widget.js" data-token="wk_..." async></script>
 * Adds a floating chat bubble (bottom-right) that opens the assistant in a panel.
 * Optional attributes: data-accent="#f87171", data-position="left".
 */
(function () {
  'use strict';

  // Resolve our own <script> tag (currentScript is set for async classic scripts;
  // fall back to scanning by attribute / filename for older browsers).
  var script =
    document.currentScript ||
    (function () {
      var all = document.querySelectorAll('script[data-token],script[src*="widget.js"]');
      return all[all.length - 1] || null;
    })();
  if (!script) return;

  var token = script.getAttribute('data-token') || script.getAttribute('data-app') || '';
  if (!token) {
    console.error('[Close AI] widget.js: missing data-token (your public wk_ token).');
    return;
  }
  if (window.__closeAiWidgetLoaded) return; // guard against double-injection
  window.__closeAiWidgetLoaded = true;

  var accent = script.getAttribute('data-accent') || '#f87171';
  var side = script.getAttribute('data-position') === 'left' ? 'left' : 'right';
  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch (e) {
    origin = '';
  }
  var chatUrl = origin + '/embed/chat?app=' + encodeURIComponent(token);

  var Z = 2147483000;
  var open = false;

  // ── Launcher button ──
  var btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Open chat');
  btn.style.cssText = [
    'position:fixed', 'bottom:20px', side + ':20px',
    'width:60px', 'height:60px', 'border-radius:50%', 'border:none',
    'background:' + accent, 'color:#fff', 'cursor:pointer',
    'box-shadow:0 8px 28px rgba(0,0,0,.28)', 'z-index:' + Z,
    'display:flex', 'align-items:center', 'justify-content:center',
    'transition:transform .2s ease, box-shadow .2s ease',
    'padding:0', '-webkit-tap-highlight-color:transparent'
  ].join(';');
  btn.onmouseenter = function () { btn.style.transform = 'scale(1.06)'; };
  btn.onmouseleave = function () { btn.style.transform = 'scale(1)'; };

  var openIcon =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z"/></svg>';
  var closeIcon =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  btn.innerHTML = openIcon;

  // ── Panel (holds the iframe) ──
  var panel = document.createElement('div');
  panel.style.cssText = [
    'position:fixed', 'bottom:92px', side + ':20px',
    'width:384px', 'max-width:calc(100vw - 32px)',
    'height:620px', 'max-height:calc(100vh - 120px)',
    'border-radius:20px', 'overflow:hidden', 'background:#0a0a0b',
    'box-shadow:0 24px 64px rgba(0,0,0,.45)', 'z-index:' + Z,
    'opacity:0', 'transform:translateY(16px) scale(.98)', 'pointer-events:none',
    'transition:opacity .25s ease, transform .25s cubic-bezier(.22,1,.36,1)',
    'border:1px solid rgba(255,255,255,.08)'
  ].join(';');

  var iframe = document.createElement('iframe');
  iframe.title = 'Chat assistant';
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
  iframe.setAttribute('loading', 'lazy');
  panel.appendChild(iframe);

  var iframeLoaded = false;
  function setOpen(next) {
    open = next;
    if (open) {
      if (!iframeLoaded) { iframe.src = chatUrl; iframeLoaded = true; }
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0) scale(1)';
      panel.style.pointerEvents = 'auto';
      btn.innerHTML = closeIcon;
      btn.setAttribute('aria-label', 'Close chat');
    } else {
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(16px) scale(.98)';
      panel.style.pointerEvents = 'none';
      btn.innerHTML = openIcon;
      btn.setAttribute('aria-label', 'Open chat');
    }
  }

  btn.addEventListener('click', function () { setOpen(!open); });
  // Close when the embedded page asks (e.g. a future close button posts a message).
  window.addEventListener('message', function (e) {
    if (e.origin === origin && e.data === 'closeai:close') setOpen(false);
  });

  function mount() {
    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
