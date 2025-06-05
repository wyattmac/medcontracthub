// This file sets a custom webpack configuration to use your Next.js app with Sentry.
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SWC minification is enabled by default in Next.js 15+
  
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
    if (process.env.NODE_ENV === 'production') {
      config.optimization.usedExports = true
      config.optimization.sideEffects = false
    }
    
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

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
  
  // Suppresses source map uploading logs during build
  silent: true,
  
  // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
  tunnelRoute: '/monitoring',
  
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  
  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
  
  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,
}

// Export the config with or without Sentry based on environment
module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig