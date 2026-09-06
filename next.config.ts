import type { NextConfig } from "next";

/**
 * The auth token lives in localStorage, so any script that runs on this origin
 * can read it. A Content-Security-Policy is what stops an injected script from
 * running in the first place, and is the difference between an XSS bug and an
 * account takeover.
 *
 * 'unsafe-inline' and 'unsafe-eval' are present because Next's runtime needs
 * them; tightening that requires nonce-based CSP, which is a separate change.
 * Even so, this closes the part that matters most — script-src limits WHERE
 * code may come from, and connect-src limits where data may be sent.
 */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Generated media arrives as data: URIs; blob: is used for the PDF viewer.
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  `connect-src 'self' ${API_ORIGIN} https:`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // The app itself must never be framed. /embed/chat is exempt below — it is
  // designed to be embedded, so a blanket frame-ancestors would break the
  // widget that customers put on their own sites.
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const embedCsp = csp.replace("frame-ancestors 'none'", "frame-ancestors *");

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs these; denying them stops a compromised script asking.
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Hide the on-screen Next.js dev indicator (the floating "N" badge)
  devIndicators: false,

  async headers() {
    return [
      {
        // The embeddable widget: same protections, but framing is the point.
        source: "/embed/:path*",
        headers: [...baseHeaders, { key: "Content-Security-Policy", value: embedCsp }],
      },
      {
        // Everything EXCEPT /embed. Next applies every matching rule and lets a
        // later one override the same key, so a plain catch-all would silently
        // reimpose frame-ancestors 'none' on the widget and break it.
        source: "/((?!embed).*)",
        headers: [
          ...baseHeaders,
          { key: "Content-Security-Policy", value: csp },
          // Redundant with frame-ancestors for modern browsers, kept for older ones.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
