// Mock for Sentry monitoring

module.exports = {
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  captureEvent: jest.fn(),
  trackEvent: jest.fn(),
  startApiTransaction: jest.fn(() => ({
    setStatus: jest.fn(),
    setData: jest.fn(),
    setTag: jest.fn(),
    finish: jest.fn(),
    startChild: jest.fn(() => ({
      setStatus: jest.fn(),
      finish: jest.fn()
    }))
  })),
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  configureScope: jest.fn((callback) => {
    callback({
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setContext: jest.fn(),
      setUser: jest.fn(),
      clear: jest.fn()
    })
  }),
  withScope: jest.fn((callback) => {
    callback({
      setTag: jest.fn(),
      setExtra: jest.fn(),
      setContext: jest.fn(),
      setUser: jest.fn()
    })
  })
}