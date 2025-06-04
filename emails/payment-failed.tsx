/**
 * Payment Failed Email Template
 * Sent when a payment attempt fails for a subscription
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

interface PaymentFailedProps {
  userName: string
  amount: string
  nextAttempt?: Date
}

export const PaymentFailed: React.FC<PaymentFailedProps> = ({
  userName,
  amount,
  nextAttempt,
}) => {
  const formattedNextAttempt = nextAttempt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(nextAttempt)
    : ''

  return (
    <Html>
      <Head />
      <Preview>Payment failed for your MedContractHub subscription</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={alertSection}>
            <Heading style={h1}>⚠️ Payment Failed</Heading>
          </Section>
          
          <Text style={text}>Hi {userName},</Text>
          
          <Text style={text}>
            We were unable to process your payment of <strong>{amount}</strong> for your
            MedContractHub subscription.
          </Text>

          <Section style={warningSection}>
            <Text style={warningText}>
              <strong>Action required:</strong> Please update your payment method to avoid
              service interruption.
            </Text>
            {nextAttempt && (
              <Text style={text}>
                We'll automatically retry the payment on {formattedNextAttempt}.
              </Text>
            )}
          </Section>

          <Section style={infoSection}>
            <Heading style={h2}>Common reasons for payment failure:</Heading>
            <Text style={text}>
              • Insufficient funds<br />
              • Card expired or canceled<br />
              • Bank declined the transaction<br />
              • Billing address mismatch
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Button
              style={button}
              href={`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`}
            >
              Update Payment Method
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Need help?{' '}
            <Link href={`${process.env.NEXT_PUBLIC_APP_URL}/help/billing`} style={link}>
              Check our billing FAQ
            </Link>{' '}
            or reply to this email for assistance.
          </Text>

          <Text style={footer}>
            To avoid losing access to your federal contract opportunities, please update
            your payment information as soon as possible.
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

const alertSection = {
  textAlign: 'center' as const,
  margin: '0 0 20px',
}

const h1 = {
  color: '#dc2626',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0',
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
  backgroundColor: '#dc2626',
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
  backgroundColor: '#fee2e2',
  borderRadius: '5px',
  padding: '20px',
  margin: '20px 0',
}

const warningText = {
  color: '#991b1b',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 10px',
}

const infoSection = {
  backgroundColor: '#f6f9fc',
  borderRadius: '5px',
  padding: '20px',
  margin: '20px 0',
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

export default PaymentFailed