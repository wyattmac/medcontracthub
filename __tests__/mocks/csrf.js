// Mock for CSRF protection

module.exports = {
  verifyCSRFToken: jest.fn(() => true),
  generateCSRFToken: jest.fn(() => 'mock-csrf-token'),
  getCSRFToken: jest.fn(() => 'mock-csrf-token')
}