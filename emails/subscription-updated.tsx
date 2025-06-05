/**
 * Subscription Updated Email Template
 * Sent when a subscription is modified (plan change, trial ending, etc.)
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

interface SubscriptionUpdatedProps {
  userName: string
  message: string
  trialEnd?: Date
}

export const SubscriptionUpdated: React.FC<SubscriptionUpdatedProps> = ({
  userName,
  message,
  trialEnd,
}) => {
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
      <Preview>Your MedContractHub subscription has been updated</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Subscription Update</Heading>
          
          <Text style={text}>Hi {userName},</Text>
          
          <Text style={text}>{message}</Text>

          {trialEnd && (
            <Section style={warningSection}>
              <Text style={warningText}>
                ⚠️ Your trial ends on <strong>{formattedTrialEnd}</strong>
              </Text>
              <Text style={text}>
                To continue using MedContractHub without interruption, please add a payment method
                before your trial expires.
              </Text>
            </Section>
          )}

          <Section style={buttonSection}>
            <Button
              style={button}
              href={`${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`}
            >
              Manage Subscription
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Questions about your subscription?{' '}
            <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/help`} style={link}>
              Visit our help center
            </Link>{' '}
            or reply to this email.
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

const warningSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '5px',
  padding: '20px',
  margin: '20px 0',
}

const warningText = {
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

export default SubscriptionUpdated