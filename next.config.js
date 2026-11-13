/** @type {import('next').NextConfig} */
const nextConfig = {distDir:process.env.PELOTONIA_NEXT_DIST_DIR||'.next'};

module.exports = nextConfig;
