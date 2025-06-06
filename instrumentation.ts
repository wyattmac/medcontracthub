export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side instrumentation
    await import('./sentry.server.config')
    
    // Start user journey monitoring
    const { startGlobalMonitoring } = await import('./lib/monitoring/scheduler')
    startGlobalMonitoring()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime instrumentation
    await import('./sentry.edge.config')
  }
}