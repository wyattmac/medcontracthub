/**
 * Visual Error Debugger using Puppeteer MCP
 * Captures screenshots and DOM state for error debugging
 */

import { errorReporter } from './error-reporter'
import { logger } from './logger'

interface VisualDebugContext {
  url: string
  error: Error
  selector?: string // Specific element that errored
  fullPage?: boolean
  deviceType?: 'desktop' | 'mobile' | 'tablet'
}

export class VisualErrorDebugger {
  /**
   * Capture error context visually using Puppeteer
   */
  static async captureErrorContext(context: VisualDebugContext): Promise<{
    screenshot?: string
    domState?: any
    consoleErrors?: string[]
    networkErrors?: string[]
  }> {
    const { url, error, selector, fullPage = true, deviceType = 'desktop' } = context
    
    try {
      // Navigate to the error page
      await (window as any).mcp__puppeteer__puppeteer_navigate({
        url,
        launchOptions: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      })
      
      // Set viewport based on device type
      const viewports = {
        desktop: { width: 1920, height: 1080 },
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 }
      }
      
      // Capture console errors
      const consoleErrors: string[] = []
      const captureConsoleErrors = await (window as any).mcp__puppeteer__puppeteer_evaluate({
        script: `
          // Inject error capturing
          const errors = [];
          window.addEventListener('error', (e) => {
            errors.push({
              message: e.message,
              source: e.filename,
              line: e.lineno,
              col: e.colno,
              error: e.error?.stack
            });
          });
          
          // Capture any existing errors in console
          if (window.console && window.console.error) {
            const originalError = window.console.error;
            window.console.error = function(...args) {
              errors.push({
                type: 'console',
                message: args.join(' ')
              });
              originalError.apply(console, args);
            };
          }
          
          // Return existing errors
          errors;
        `
      })
      
      // Capture network errors
      const networkErrors = await (window as any).mcp__puppeteer__puppeteer_evaluate({
        script: `
          // Get failed network requests from performance API
          const failedRequests = performance.getEntriesByType('resource')
            .filter(entry => entry.responseStatus >= 400 || entry.responseStatus === 0)
            .map(entry => ({
              url: entry.name,
              status: entry.responseStatus,
              duration: entry.duration,
              type: entry.initiatorType
            }));
          failedRequests;
        `
      })
      
      // Capture screenshot
      const screenshotName = `error_${Date.now()}_${error.name}`
      let screenshot: string | undefined
      
      try {
        if (selector) {
          // Screenshot specific element
          await (window as any).mcp__puppeteer__puppeteer_screenshot({
            name: screenshotName,
            selector,
            encoded: true // Get base64 for storage
          })
          screenshot = screenshotName
        } else {
          // Full page screenshot
          await (window as any).mcp__puppeteer__puppeteer_screenshot({
            name: screenshotName,
            width: viewports[deviceType].width,
            height: fullPage ? undefined : viewports[deviceType].height,
            encoded: true
          })
          screenshot = screenshotName
        }
      } catch (screenshotError) {
        logger.error('Failed to capture error screenshot', screenshotError)
      }
      
      // Capture DOM state around error
      let domState: any
      if (selector) {
        domState = await (window as any).mcp__puppeteer__puppeteer_evaluate({
          script: `
            const element = document.querySelector('${selector}');
            if (element) {
              {
                tagName: element.tagName,
                className: element.className,
                id: element.id,
                innerHTML: element.innerHTML.substring(0, 500), // Truncate for size
                computedStyles: window.getComputedStyle(element).cssText,
                boundingBox: element.getBoundingClientRect(),
                attributes: Array.from(element.attributes).map(attr => ({
                  name: attr.name,
                  value: attr.value
                })),
                parentElement: element.parentElement ? {
                  tagName: element.parentElement.tagName,
                  className: element.parentElement.className,
                  id: element.parentElement.id
                } : null
              }
            } else {
              null
            }
          `
        })
      }
      
      // Capture page metadata
      const pageMetadata = await (window as any).mcp__puppeteer__puppeteer_evaluate({
        script: `
          ({
            title: document.title,
            url: window.location.href,
            referrer: document.referrer,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight
            },
            documentReady: document.readyState,
            errorCount: document.querySelectorAll('.error, [data-error]').length,
            hasReactDevTools: !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            hasNextData: !!window.__NEXT_DATA__,
            localStorage: Object.keys(localStorage || {}),
            sessionStorage: Object.keys(sessionStorage || {})
          })
        `
      })
      
      // Report visual debugging info
      errorReporter.setGlobalContext('visualDebug', {
        screenshot,
        pageMetadata,
        domState,
        consoleErrors: captureConsoleErrors,
        networkErrors
      })
      
      return {
        screenshot,
        domState,
        consoleErrors: captureConsoleErrors,
        networkErrors
      }
      
    } catch (error) {
      logger.error('Visual debugging failed', error)
      return {
        consoleErrors: [],
        networkErrors: []
      }
    }
  }
  
  /**
   * Capture error reproduction steps
   */
  static async captureReproductionSteps(
    steps: Array<{
      action: 'navigate' | 'click' | 'fill' | 'select' | 'hover'
      target?: string
      value?: string
      description: string
    }>
  ): Promise<void> {
    try {
      for (const step of steps) {
        logger.info(`Reproduction step: ${step.description}`)
        
        switch (step.action) {
          case 'navigate':
            await (window as any).mcp__puppeteer__puppeteer_navigate({
              url: step.target!
            })
            break
            
          case 'click':
            await (window as any).mcp__puppeteer__puppeteer_click({
              selector: step.target!
            })
            break
            
          case 'fill':
            await (window as any).mcp__puppeteer__puppeteer_fill({
              selector: step.target!,
              value: step.value!
            })
            break
            
          case 'select':
            await (window as any).mcp__puppeteer__puppeteer_select({
              selector: step.target!,
              value: step.value!
            })
            break
            
          case 'hover':
            await (window as any).mcp__puppeteer__puppeteer_hover({
              selector: step.target!
            })
            break
        }
        
        // Wait a bit between steps
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      logger.error('Failed to capture reproduction steps', error)
    }
  }
  
  /**
   * Run automated error diagnostics
   */
  static async runDiagnostics(url: string): Promise<{
    accessibility: any
    performance: any
    seo: any
    bestPractices: any
  }> {
    try {
      // Navigate to page
      await (window as any).mcp__puppeteer__puppeteer_navigate({ url })
      
      // Run accessibility checks
      const accessibility = await (window as any).mcp__puppeteer__puppeteer_evaluate({
        script: `
          // Basic accessibility checks
          const issues = [];
          
          // Check for missing alt text
          document.querySelectorAll('img:not([alt])').forEach(img => {
            issues.push({
              type: 'missing-alt',
              element: img.outerHTML.substring(0, 100)
            });
          });
          
          // Check for missing labels
          document.querySelectorAll('input:not([aria-label]):not([id])').forEach(input => {
            issues.push({
              type: 'missing-label',
              element: input.outerHTML
            });
          });
          
          // Check color contrast (simplified)
          const lowContrast = Array.from(document.querySelectorAll('*')).filter(el => {
            const style = window.getComputedStyle(el);
            const bg = style.backgroundColor;
            const fg = style.color;
            // This is simplified - real contrast checking is complex
            return bg && fg && bg !== 'rgba(0, 0, 0, 0)';
          }).length;
          
          ({
            issues,
            score: issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 10))
          })
        `
      })
      
      // Check performance metrics
      const performance = await (window as any).mcp__puppeteer__puppeteer_evaluate({
        script: `
          const perfData = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          
          ({
            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            totalResources: resources.length,
            totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
            slowResources: resources.filter(r => r.duration > 1000).map(r => ({
              url: r.name,
              duration: r.duration,
              size: r.transferSize
            }))
          })
        `
      })
      
      // SEO checks
      const seo = await (window as any).mcp__puppeteer__puppeteer_evaluate({
        script: `
          ({
            title: document.title,
            titleLength: document.title.length,
            metaDescription: document.querySelector('meta[name="description"]')?.content,
            metaDescriptionLength: document.querySelector('meta[name="description"]')?.content?.length || 0,
            h1Count: document.querySelectorAll('h1').length,
            canonicalUrl: document.querySelector('link[rel="canonical"]')?.href,
            openGraph: {
              title: document.querySelector('meta[property="og:title"]')?.content,
              description: document.querySelector('meta[property="og:description"]')?.content,
              image: document.querySelector('meta[property="og:image"]')?.content
            }
          })
        `
      })
      
      // Best practices
      const bestPractices = await (window as any).mcp__puppeteer__puppeteer_evaluate({
        script: `
          ({
            hasHttps: window.location.protocol === 'https:',
            hasViewport: !!document.querySelector('meta[name="viewport"]'),
            consoleErrors: window.__errorCount || 0,
            deprecatedAPIs: typeof window.webkitStorageInfo !== 'undefined',
            mixedContent: Array.from(document.querySelectorAll('*')).some(el => {
              const src = el.src || el.href;
              return src && src.startsWith('http://') && window.location.protocol === 'https:';
            })
          })
        `
      })
      
      return {
        accessibility,
        performance,
        seo,
        bestPractices
      }
      
    } catch (error) {
      logger.error('Diagnostics failed', error)
      return {
        accessibility: { error: 'Failed to run' },
        performance: { error: 'Failed to run' },
        seo: { error: 'Failed to run' },
        bestPractices: { error: 'Failed to run' }
      }
    }
  }
}

// Export helper function for error boundaries
export async function captureErrorScreenshot(
  error: Error,
  errorInfo?: React.ErrorInfo
): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    try {
      const visualDebug = await VisualErrorDebugger.captureErrorContext({
        url: window.location.href,
        error,
        selector: errorInfo?.componentStack ? '.error-boundary' : undefined
      })
      
      logger.info('Visual error debug captured', visualDebug)
    } catch (e) {
      logger.error('Failed to capture visual debug', e)
    }
  }
}