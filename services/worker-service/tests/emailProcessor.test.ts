import { Job } from 'bullmq';
import { processEmailJob, EmailJobSchema } from '../src/jobs/emailProcessor';
import sgMail from '@sendgrid/mail';

describe('Email Processor', () => {
  let mockJob: Partial<Job>;

  beforeEach(() => {
    mockJob = {
      id: 'test-job-1',
      name: 'send-email',
      data: {},
      updateProgress: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('processEmailJob', () => {
    it('should process opportunity reminder email', async () => {
      mockJob.data = {
        type: 'opportunity-reminder',
        data: {
          userId: 'user-123',
          email: 'test@example.com',
          opportunities: [
            {
              id: 'opp-1',
              title: 'Test Opportunity',
              agency: 'Test Agency',
              responseDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              daysUntilDeadline: 3,
            },
          ],
        },
      };

      await processEmailJob(mockJob as Job);

      // Verify email was sent (in console mode during tests)
      expect(mockJob.updateProgress).toHaveBeenCalled();
    });

    it('should process welcome email', async () => {
      mockJob.data = {
        type: 'welcome',
        data: {
          userId: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      await processEmailJob(mockJob as Job);

      expect(mockJob.updateProgress).toHaveBeenCalled();
    });

    it('should process proposal submitted email', async () => {
      mockJob.data = {
        type: 'proposal-submitted',
        data: {
          userId: 'user-123',
          email: 'test@example.com',
          proposalId: 'prop-123',
          opportunityTitle: 'Test Opportunity',
          submittedAt: new Date().toISOString(),
        },
      };

      await processEmailJob(mockJob as Job);

      expect(mockJob.updateProgress).toHaveBeenCalled();
    });

    it('should process weekly summary email', async () => {
      mockJob.data = {
        type: 'weekly-summary',
        data: {
          userId: 'user-123',
          email: 'test@example.com',
          stats: {
            newOpportunities: 15,
            proposalsSubmitted: 3,
            upcomingDeadlines: 5,
          },
          topOpportunities: [
            {
              id: 'opp-1',
              title: 'Top Opportunity',
              agency: 'Test Agency',
            },
          ],
        },
      };

      await processEmailJob(mockJob as Job);

      expect(mockJob.updateProgress).toHaveBeenCalled();
    });

    it('should handle invalid job data', async () => {
      mockJob.data = {
        type: 'invalid-type',
        data: {},
      };

      await expect(processEmailJob(mockJob as Job)).rejects.toThrow();
    });
  });

  describe('EmailJobSchema', () => {
    it('should validate opportunity reminder schema', () => {
      const validData = {
        type: 'opportunity-reminder',
        data: {
          userId: 'user-123',
          email: 'test@example.com',
          opportunities: [
            {
              id: 'opp-1',
              title: 'Test',
              agency: 'Agency',
              responseDeadline: '2024-12-31',
              daysUntilDeadline: 10,
            },
          ],
        },
      };

      expect(() => EmailJobSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid email job data', () => {
      const invalidData = {
        type: 'opportunity-reminder',
        data: {
          // Missing required fields
          email: 'test@example.com',
        },
      };

      expect(() => EmailJobSchema.parse(invalidData)).toThrow();
    });
  });
});