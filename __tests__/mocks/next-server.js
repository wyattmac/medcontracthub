// Mock for next/server in test environment

class MockHeaders extends Map {
  get(key) {
    return super.get(key.toLowerCase())
  }
  
  set(key, value) {
    return super.set(key.toLowerCase(), value)
  }
  
  has(key) {
    return super.has(key.toLowerCase())
  }
}

class MockNextRequest {
  constructor(url, options = {}) {
    this.url = url
    this.method = options.method || 'GET'
    this.headers = new MockHeaders(Object.entries(options.headers || {}))
    this.nextUrl = new URL(url)
    this.body = options.body
  }
  
  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body)
    }
    return this.body || {}
  }
  
  async text() {
    if (typeof this.body === 'string') {
      return this.body
    }
    return JSON.stringify(this.body || '')
  }
}

class MockNextResponse extends Response {
  constructor(body, init) {
    super(body, init)
  }
  
  static json(body, init = {}) {
    const response = new Response(JSON.stringify(body), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {})
      }
    })
    
    // Add custom properties for tests
    response.status = init.status || 200
    response.ok = response.status >= 200 && response.status < 300
    
    // Override json method to return parsed body
    response.json = async () => body
    
    return response
  }
  
  static redirect(url, status = 302) {
    return new Response(null, {
      status,
      headers: { location: url }
    })
  }
  
  static error() {
    return new Response(null, { status: 500 })
  }
}

module.exports = {
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse
}