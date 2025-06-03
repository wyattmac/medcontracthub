/**
 * Opportunity Deadline Reminder Email Template
 * Professional email design for federal contracting platform
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
  Img,
  Row,
  Column,
  Link,
  Preview
} from '@react-email/components'

interface IOpportunityReminderProps {
  opportunityTitle: string
  solicitationNumber: string
  deadlineDate: string
  deadlineTime: string
  daysRemaining: number
  opportunityUrl: string
  companyName: string
  estimatedValue?: string
  description?: string
}

export const OpportunityDeadlineReminder = ({
  opportunityTitle,
  solicitationNumber,
  deadlineDate,
  deadlineTime,
  daysRemaining,
  opportunityUrl,
  companyName,
  estimatedValue,
  description
}: IOpportunityReminderProps) => {
  const isUrgent = daysRemaining <= 1
  const urgencyColor = isUrgent ? '#dc2626' : daysRemaining <= 3 ? '#f59e0b' : '#059669'
  
  return (
    <Html>
      <Head />
      <Preview>
{`${isUrgent ? '🚨 URGENT: ' : '⏰ Reminder: '}${opportunityTitle} deadline in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Row>
              <Column>
                <Text style={logo}>🏥 MedContractHub</Text>
              </Column>
              <Column align="right">
                <Text style={headerDate}>{new Date().toLocaleDateString()}</Text>
              </Column>
            </Row>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            {/* Urgency Banner */}
            <Section style={{
              ...urgencyBanner,
              backgroundColor: isUrgent ? '#fef2f2' : daysRemaining <= 3 ? '#fffbeb' : '#f0fdf4',
              borderLeft: `4px solid ${urgencyColor}`
            }}>
              <Text style={{
                ...urgencyText,
                color: urgencyColor
              }}>
                {isUrgent ? '🚨 URGENT DEADLINE' : '⏰ UPCOMING DEADLINE'}
              </Text>
              <Text style={urgencySubtext}>
{`${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining`}
              </Text>
            </Section>

            {/* Greeting */}
            <Text style={greeting}>Hi {companyName},</Text>
            
            <Text style={bodyText}>
              This is a reminder that the deadline for federal contracting opportunity 
              <strong> "{opportunityTitle}"</strong> is approaching.
            </Text>

            {/* Opportunity Details Card */}
            <Section style={opportunityCard}>
              <Text style={opportunityCardTitle}>Opportunity Details</Text>
              
              <Row style={detailRow}>
                <Column style={detailLabel}>
                  <Text style={labelText}>Solicitation:</Text>
                </Column>
                <Column>
                  <Text style={valueText}>{solicitationNumber}</Text>
                </Column>
              </Row>

              <Row style={detailRow}>
                <Column style={detailLabel}>
                  <Text style={labelText}>Deadline:</Text>
                </Column>
                <Column>
                  <Text style={{...valueText, fontWeight: 'bold', color: urgencyColor}}>
                    {deadlineDate} at {deadlineTime}
                  </Text>
                </Column>
              </Row>

              {estimatedValue && (
                <Row style={detailRow}>
                  <Column style={detailLabel}>
                    <Text style={labelText}>Est. Value:</Text>
                  </Column>
                  <Column>
                    <Text style={valueText}>{estimatedValue}</Text>
                  </Column>
                </Row>
              )}

              {description && (
                <Row style={detailRow}>
                  <Column>
                    <Text style={labelText}>Description:</Text>
                    <Text style={{...valueText, marginTop: '4px'}}>
                      {description.length > 200 ? 
                        `${description.substring(0, 200)}...` : 
                        description
                      }
                    </Text>
                  </Column>
                </Row>
              )}
            </Section>

            {/* Action Button */}
            <Section style={buttonSection}>
              <Button href={opportunityUrl} style={button}>
                View Full Opportunity
              </Button>
            </Section>

            {/* Additional Actions */}
            <Section style={actionsSection}>
              <Text style={actionsTitle}>Quick Actions:</Text>
              <Text style={actionsList}>
                • <Link href={opportunityUrl} style={actionLink}>Review opportunity details</Link><br/>
                • <Link href={`${opportunityUrl}?tab=analysis`} style={actionLink}>View AI analysis</Link><br/>
                • <Link href="/proposals/new" style={actionLink}>Start new proposal</Link>
              </Text>
            </Section>

            {/* Tips Section */}
            <Section style={tipsSection}>
              <Text style={tipsTitle}>💡 Submission Tips:</Text>
              <Text style={tipsList}>
                • Review all requirements carefully<br/>
                • Prepare required certifications<br/>
                • Submit with time to spare before deadline<br/>
                • Keep copies of all submitted documents
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Row>
              <Column>
                <Text style={footerText}>
                  <Link href="https://medcontracthub.com" style={footerLink}>
                    MedContractHub
                  </Link>
                  <br/>
                  Federal Medical Supply Contracting Platform
                </Text>
              </Column>
              <Column align="right">
                <Text style={footerText}>
                  <Link href="/settings/notifications" style={footerLink}>
                    Manage Notifications
                  </Link>
                </Text>
              </Column>
            </Row>
            <Text style={footerDisclaimer}>
              This is an automated reminder. Please do not reply to this email.
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
  padding: '0 0 20px',
}

const logo = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0',
}

const headerDate = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
}

const content = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  padding: '32px',
}

const urgencyBanner = {
  padding: '16px',
  borderRadius: '6px',
  marginBottom: '24px',
}

const urgencyText = {
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 4px 0',
}

const urgencySubtext = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
}

const greeting = {
  fontSize: '16px',
  color: '#1f2937',
  margin: '0 0 16px 0',
}

const bodyText = {
  fontSize: '16px',
  lineHeight: '1.5',
  color: '#374151',
  margin: '0 0 24px 0',
}

const opportunityCard = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '20px',
  marginBottom: '24px',
}

const opportunityCardTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 16px 0',
}

const detailRow = {
  marginBottom: '8px',
}

const detailLabel = {
  width: '120px',
  paddingRight: '12px',
}

const labelText = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0',
  fontWeight: '500',
}

const valueText = {
  fontSize: '14px',
  color: '#1f2937',
  margin: '0',
}

const buttonSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
}

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}

const actionsSection = {
  marginBottom: '24px',
}

const actionsTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 8px 0',
}

const actionsList = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0',
}

const actionLink = {
  color: '#3b82f6',
  textDecoration: 'none',
}

const tipsSection = {
  backgroundColor: '#eff6ff',
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '24px',
}

const tipsTitle = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#1e40af',
  margin: '0 0 8px 0',
}

const tipsList = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#1e40af',
  margin: '0',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '32px 0',
}

const footer = {
  paddingTop: '16px',
}

const footerText = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 8px 0',
}

const footerLink = {
  color: '#3b82f6',
  textDecoration: 'none',
}

const footerDisclaimer = {
  fontSize: '11px',
  color: '#9ca3af',
  margin: '16px 0 0 0',
  textAlign: 'center' as const,
}

export default OpportunityDeadlineReminder