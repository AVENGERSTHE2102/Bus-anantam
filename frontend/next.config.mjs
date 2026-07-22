/** @type {import('next').NextConfig} */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

const nextConfig = {
  // Capacitor ships the compiled site inside the Android app. Keep the normal
  // Next server build untouched for browser development and deployment.
  ...(isCapacitorBuild ? { output: 'export', distDir: 'out' } : {}),
};

export default nextConfig;
