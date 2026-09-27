// Next.js reads this file at build/startup time, so it executes in Node rather
// than becoming part of the browser bundle.
const nextConfig = {
  // Next 16 owns .next/dev/lock and exposes /_next/mcp during development so
  // agents can reuse one server and inspect routes, logs, and compilation issues.
  // Trace server dependencies from the repository root for deployment packaging.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
