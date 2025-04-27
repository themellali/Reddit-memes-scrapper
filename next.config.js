
// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Add Reddit image domains
      {
        protocol: 'https',
        hostname: 'i.redd.it',
        port: '',
        pathname: '/**',
      },
       {
         protocol: 'https',
         hostname: 'preview.redd.it',
         port: '',
         pathname: '/**',
       },
       // Add Ad image domain
       {
        protocol: 'https',
        hostname: 'www.imglnkx.com',
        port: '',
        pathname: '/**',
      },
      // Add other allowed hostnames here if needed
    ],
  },
};

export default nextConfig;
