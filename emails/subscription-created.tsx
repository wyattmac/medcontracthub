/**
 * Subscription Created Email Template
 * Sent when a user successfully starts a subscription
 */

import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface SubscriptionCreatedProps {
  userName: string
  planName: string
  trialEnd?: Date
}

export const SubscriptionCreated: React.FC<SubscriptionCreatedProps> = ({
  userName,
  planName,
  trialEnd,
}) => {
  const isTrialing = !!trialEnd
  const formattedTrialEnd = trialEnd
    ? new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(trialEnd)
    : ''

  return (
    <Html>
      <Head />
      <Preview>
        Welcome to MedContractHub {planName} Plan{isTrialing ? ' - 14-day free trial started' : ''}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to MedContractHub!</Heading>
          
          <Text style={text}>Hi {userName},</Text>
          
          <Text style={text}>
            Thank you for subscribing to the MedContractHub {planName} plan! 
            {isTrialing
              ? ` Your 14-day free trial has started and will end on ${formattedTrialEnd}.`
              : ' Your subscription is now active.'}
          </Text>

          <Section style={featureSection}>
            <Heading style={h2}>What's included in your {planName} plan:</Heading>
            <Text style={text}>
              • Access to federal contract opportunities from SAM.gov<br />
              • AI-powered contract analysis and recommendations<br />
              • Document OCR and processing capabilities<br />
              • Email alerts for matching opportunities<br />
              • Export to multiple formats<br />
              {planName === 'Professional' && '• API access for integrations<br />'}
              {planName === 'Enterprise' && '• Unlimited everything + priority support<br />'}
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Button
              style={button}
              href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`}
            >
              Go to Dashboard
            </Button>
          </Section>

          {isTrialing && (
            <Section style={tipSection}>
              <Text style={tipText}>
                💡 <strong>Pro tip:</strong> Make the most of your trial by:
              </Text>
              <Text style={text}>
                • Setting up your company profile and NAICS codes<br />
                • Uploading past contracts for AI analysis<br />
                • Creating saved searches for relevant opportunities<br />
                • Enabling email alerts for new matches
              </Text>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Need help getting started?{' '}
            <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/help`} style={link}>
              Check out our guide
            </Link>{' '}
            or reply to this email.
          </Text>

          <Text style={footer}>
            Manage your subscription anytime in your{' '}
            <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`} style={link}>
              billing settings
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  borderRadius: '5px',
  maxWidth: '580px',
}

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}

const h2 = {
  color: '#333',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 15px',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 15px',
}

const button = {
  backgroundColor: '#5469d4',
  borderRadius: '5px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 20px',
}

const buttonSection = {
  margin: '30px 0',
  textAlign: 'center' as const,
}

const featureSection = {
  backgroundColor: '#f6f9fc',
  borderRadius: '5px',
  padding: '20px',
  margin: '20px 0',
}

const tipSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '5px',
  padding: '20px',
  margin: '20px 0',
}

const tipText = {
  color: '#92400e',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 10px',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '30px 0',
}

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 10px',
  textAlign: 'center' as const,
}

const link = {
  color: '#5469d4',
  textDecoration: 'underline',
}

export default SubscriptionCreated