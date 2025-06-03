/**
 * Welcome Email Template
 * Sent to new users after successful registration
 */

import React from 'react'
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Row,
  Column,
  Link,
  Preview
} from '@react-email/components'

interface IWelcomeEmailProps {
  companyName: string
  firstName?: string
  dashboardUrl: string
}

export const WelcomeEmail = ({
  companyName,
  firstName,
  dashboardUrl
}: IWelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to MedContractHub - Your Federal Contracting Journey Starts Here</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>🏥 MedContractHub</Text>
            <Text style={tagline}>Federal Medical Supply Contracting Platform</Text>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Text style={greeting}>
              Welcome{firstName ? ` ${firstName}` : ''} from {companyName}!
            </Text>
            
            <Text style={bodyText}>
              Thank you for joining MedContractHub. You now have access to thousands of 
              federal medical supply contracting opportunities, AI-powered insights, and 
              tools to help you win more contracts.
            </Text>

            {/* Getting Started Section */}
            <Section style={gettingStartedSection}>
              <Text style={sectionTitle}>🚀 Getting Started</Text>
              
              <Text style={stepText}>
                <strong>1. Complete Your Profile</strong><br/>
                Add your NAICS codes and certifications for better opportunity matching
              </Text>
              
              <Text style={stepText}>
                <strong>2. Explore Opportunities</strong><br/>
                Browse over 20,000+ federal contracting opportunities
              </Text>
              
              <Text style={stepText}>
                <strong>3. Use AI Analysis</strong><br/>
                Get intelligent insights on opportunity requirements and competition
              </Text>
              
              <Text style={stepText}>
                <strong>4. Set Up Notifications</strong><br/>
                Never miss deadlines with automated reminder emails
              </Text>
            </Section>

            {/* CTA Button */}
            <Section style={buttonSection}>
              <Button href={dashboardUrl} style={button}>
                Go to Dashboard
              </Button>
            </Section>

            {/* Features Overview */}
            <Section style={featuresSection}>
              <Text style={sectionTitle}>✨ What You Can Do</Text>
              
              <Row style={featureRow}>
                <Column style={featureIcon}>🔍</Column>
                <Column>
                  <Text style={featureTitle}>Smart Search</Text>
                  <Text style={featureDesc}>Find opportunities matching your capabilities</Text>
                </Column>
              </Row>
              
              <Row style={featureRow}>
                <Column style={featureIcon}>🤖</Column>
                <Column>
                  <Text style={featureTitle}>AI Analysis</Text>
                  <Text style={featureDesc}>Get insights on requirements and win probability</Text>
                </Column>
              </Row>
              
              <Row style={featureRow}>
                <Column style={featureIcon}>📊</Column>
                <Column>
                  <Text style={featureTitle}>Analytics</Text>
                  <Text style={featureDesc}>Track your progress and optimize your approach</Text>
                </Column>
              </Row>
              
              <Row style={featureRow}>
                <Column style={featureIcon}>📝</Column>
                <Column>
                  <Text style={featureTitle}>Proposal Tools</Text>
                  <Text style={featureDesc}>Manage proposals and track submissions</Text>
                </Column>
              </Row>
            </Section>

            {/* Support Section */}
            <Section style={supportSection}>
              <Text style={sectionTitle}>Need Help?</Text>
              <Text style={supportText}>
                • <Link href="/docs" style={supportLink}>Browse our documentation</Link><br/>
                • <Link href="/support" style={supportLink}>Contact support team</Link><br/>
                • <Link href="/tutorials" style={supportLink}>Watch video tutorials</Link>
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              <Link href="https://medcontracthub.com" style={footerLink}>
                MedContractHub
              </Link>
              <br/>
              Helping medical companies win federal contracts
            </Text>
            <Text style={footerDisclaimer}>
              This email was sent to you because you created an account with MedContractHub.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '580px',
}

const header = {
  textAlign: 'center' as const,
  padding: '0 0 32px',
}

const logo = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 8px 0',
}

const tagline = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
}

const content = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  padding: '40px',
}

const greeting = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}

const bodyText = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 32px 0',
}

const gettingStartedSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '32px',
}

const sectionTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 16px 0',
}

const stepText = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 16px 0',
}

const buttonSection = {
  textAlign: 'center' as const,
  marginBottom: '40px',
}

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
}

const featuresSection = {
  marginBottom: '32px',
}

const featureRow = {
  marginBottom: '16px',
}

const featureIcon = {
  width: '40px',
  fontSize: '20px',
}

const featureTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 4px 0',
}

const featureDesc = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
}

const supportSection = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '20px',
}

const supportText = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#1e40af',
  margin: '0',
}

const supportLink = {
  color: '#3b82f6',
  textDecoration: 'none',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '40px 0 32px 0',
}

const footer = {
  textAlign: 'center' as const,
}

const footerText = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0 0 16px 0',
}

const footerLink = {
  color: '#3b82f6',
  textDecoration: 'none',
}

const footerDisclaimer = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '0',
}

export default WelcomeEmail