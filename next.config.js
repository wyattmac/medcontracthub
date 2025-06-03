/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable SWC minification for faster builds and smaller bundles
  swcMinify: true,
  
  // Optimize images with modern formats
  images: {
    formats: ['image/avif', 'image/webp'],
    domains: ['localhost'],
  },
  
  // Production optimizations
  productionBrowserSourceMaps: false,
  compress: true,
  
  // Optimize CSS
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Webpack optimizations
  webpack: (config, { isServer, isClient }) => {
    // Optimize client-side bundles
    if (isClient) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          default: false,
          vendors: false,
          // Split vendor code
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common code shared between pages
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
          // Chart libraries bundle
          charts: {
            name: 'charts',
            test: /[\\/]node_modules[\\/](recharts|d3-.*|victory-.*)[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          // PDF libraries bundle
          pdf: {
            name: 'pdf',
            test: /[\\/]node_modules[\\/](@react-pdf|pdfjs-dist)[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          // Excel libraries bundle
          excel: {
            name: 'excel',
            test: /[\\/]node_modules[\\/](xlsx|exceljs)[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          // Email libraries bundle
          email: {
            name: 'email',
            test: /[\\/]node_modules[\\/](@react-email|resend)[\\/]/,
            chunks: 'all',
            priority: 25,
          },
        },
      }
    }
    
    // Enable tree shaking for ES modules
    config.optimization.usedExports = true
    config.optimization.sideEffects = false
    
    return config
  },
  
  // Experimental performance features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'recharts',
      '@tanstack/react-query',
      'date-fns',
      'lucide-react',
      '@supabase/supabase-js',
    ],
  },
}

module.exports = nextConfig