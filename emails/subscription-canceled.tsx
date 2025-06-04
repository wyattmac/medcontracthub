/**
 * Subscription Canceled Email Template
 * Sent when a subscription is canceled or expires
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

interface SubscriptionCanceledProps {
  userName: string
  endDate: Date
}

export const SubscriptionCanceled: React.FC<SubscriptionCanceledProps> = ({
  userName,
  endDate,
}) => {
  const formattedEndDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(endDate)

  return (
    <Html>
      <Head />
      <Preview>Your MedContractHub subscription has been canceled</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Subscription Canceled</Heading>
          
          <Text style={text}>Hi {userName},</Text>
          
          <Text style={text}>
            We're sorry to see you go. Your MedContractHub subscription has been canceled
            and will remain active until <strong>{formattedEndDate}</strong>.
          </Text>

          <Section style={infoSection}>
            <Heading style={h2}>What happens next?</Heading>
            <Text style={text}>
              • You'll continue to have full access until {formattedEndDate}<br />
              • Your saved opportunities and data will be preserved<br />
              • You can reactivate your subscription anytime<br />
              • No further charges will be made to your payment method
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Button
              style={button}
              href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`}
            >
              Reactivate Subscription
            </Button>
          </Section>

          <Hr style={hr} />

          <Section>
            <Text style={feedbackText}>
              We'd love to hear why you decided to cancel. Your feedback helps us improve
              MedContractHub for everyone.
            </Text>
            <Text style={footer}>
              <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/feedback`} style={link}>
                Share feedback
              </Link>{' '}
              or simply reply to this email.
            </Text>
          </Section>

          <Text style={footer}>
            Thank you for being a MedContractHub customer. We hope to see you again soon!
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

const infoSection = {
  backgroundColor: '#f6f9fc',
  borderRadius: '5px',
  padding: '20px',
  margin: '20px 0',
}

const feedbackText = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 10px',
  fontStyle: 'italic',
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

export default SubscriptionCanceled