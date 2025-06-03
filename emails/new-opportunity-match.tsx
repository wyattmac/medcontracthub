/**
 * New Opportunity Match Email Template
 * Notification for opportunities matching company NAICS codes
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

interface IOpportunityMatchProps {
  companyName: string
  opportunities: Array<{
    id: string
    title: string
    solicitationNumber: string
    deadline: string
    estimatedValue?: string
    agency: string
    matchReason: string
    confidence: number
  }>
  totalMatches: number
  timeframe: string
}

export const NewOpportunityMatch = ({
  companyName,
  opportunities,
  totalMatches,
  timeframe
}: IOpportunityMatchProps) => {
  const topOpportunities = opportunities.slice(0, 3)
  const hasMoreOpportunities = totalMatches > topOpportunities.length

  return (
    <Html>
      <Head />
      <Preview>
{`🎯 ${totalMatches} new federal contracting ${totalMatches === 1 ? 'opportunity matches' : 'opportunities match'} your profile`}
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
            {/* Match Banner */}
            <Section style={matchBanner}>
              <Text style={matchIcon}>🎯</Text>
              <Text style={matchTitle}>New Opportunities Found!</Text>
              <Text style={matchSubtext}>
  {`${totalMatches} ${totalMatches === 1 ? 'opportunity' : 'opportunities'} matching your profile ${timeframe}`}
              </Text>
            </Section>

            {/* Greeting */}
            <Text style={greeting}>Hi {companyName},</Text>
            
            <Text style={bodyText}>
{`We've found ${totalMatches} new federal contracting ${totalMatches === 1 ? 'opportunity' : 'opportunities'} that match your company's NAICS codes and capabilities. Here are the top matches:`}
            </Text>

            {/* Opportunities List */}
            {topOpportunities.map((opportunity, index) => (
              <Section key={opportunity.id} style={opportunityCard}>
                <Row>
                  <Column style={confidenceColumn}>
                    <Text style={confidenceScore}>
                      {Math.round(opportunity.confidence)}%
                    </Text>
                    <Text style={confidenceLabel}>Match</Text>
                  </Column>
                  <Column style={opportunityDetails}>
                    <Text style={opportunityTitle}>{opportunity.title}</Text>
                    <Text style={opportunityMeta}>
                      {opportunity.solicitationNumber} • {opportunity.agency}
                    </Text>
                    
                    <Row style={opportunityInfoRow}>
                      <Column>
                        <Text style={infoLabel}>Deadline:</Text>
                        <Text style={infoValue}>{opportunity.deadline}</Text>
                      </Column>
                      {opportunity.estimatedValue && (
                        <Column>
                          <Text style={infoLabel}>Est. Value:</Text>
                          <Text style={infoValue}>{opportunity.estimatedValue}</Text>
                        </Column>
                      )}
                    </Row>

                    <Text style={matchReason}>
                      <strong>Why it's a match:</strong> {opportunity.matchReason}
                    </Text>

                    <Button 
                      href={`${process.env.NEXT_PUBLIC_APP_URL}/opportunities/${opportunity.id}`}
                      style={opportunityButton}
                    >
                      View Details
                    </Button>
                  </Column>
                </Row>
              </Section>
            ))}

            {/* View All Button */}
            {hasMoreOpportunities && (
              <Section style={viewAllSection}>
                <Text style={viewAllText}>
                  {totalMatches - topOpportunities.length} more {totalMatches - topOpportunities.length === 1 ? 'opportunity' : 'opportunities'} available
                </Text>
                <Button 
                  href={`${process.env.NEXT_PUBLIC_APP_URL}/opportunities?filter=matches`}
                  style={viewAllButton}
                >
                  View All {totalMatches} Opportunities
                </Button>
              </Section>
            )}

            {/* Quick Actions */}
            <Section style={actionsSection}>
              <Text style={actionsTitle}>Quick Actions:</Text>
              <Text style={actionsList}>
                • <Link href="/opportunities?filter=matches" style={actionLink}>Browse all matches</Link><br/>
                • <Link href="/saved" style={actionLink}>Review saved opportunities</Link><br/>
                • <Link href="/settings/profile" style={actionLink}>Update company profile</Link><br/>
                • <Link href="/analytics" style={actionLink}>View matching analytics</Link>
              </Text>
            </Section>

            {/* Tips Section */}
            <Section style={tipsSection}>
              <Text style={tipsTitle}>💡 Pro Tips:</Text>
              <Text style={tipsList}>
                • Review opportunities with 80%+ match confidence first<br/>
                • Save interesting opportunities to track deadlines<br/>
                • Use AI analysis to understand requirements<br/>
                • Set up deadline reminders for promising opportunities
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
              Matches are based on your NAICS codes and profile. 
              <Link href="/settings/notifications" style={footerLink}>Unsubscribe</Link>
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

const matchBanner = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  padding: '20px',
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const matchIcon = {
  fontSize: '32px',
  margin: '0 0 8px 0',
}

const matchTitle = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#059669',
  margin: '0 0 4px 0',
}

const matchSubtext = {
  fontSize: '14px',
  color: '#065f46',
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
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '20px',
  marginBottom: '16px',
}

const confidenceColumn = {
  width: '80px',
  textAlign: 'center' as const,
  paddingRight: '16px',
}

const confidenceScore = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#059669',
  margin: '0',
}

const confidenceLabel = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0',
}

const opportunityDetails = {
  width: '100%',
}

const opportunityTitle = {
  fontSize: '16px',
  fontWeight: 'bold',
  color: '#1f2937',
  margin: '0 0 4px 0',
}

const opportunityMeta = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0 0 12px 0',
}

const opportunityInfoRow = {
  marginBottom: '12px',
}

const infoLabel = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 2px 0',
  fontWeight: '500',
}

const infoValue = {
  fontSize: '14px',
  color: '#1f2937',
  margin: '0',
}

const matchReason = {
  fontSize: '14px',
  color: '#374151',
  margin: '0 0 16px 0',
  backgroundColor: '#f9fafb',
  padding: '8px',
  borderRadius: '4px',
}

const opportunityButton = {
  backgroundColor: '#3b82f6',
  borderRadius: '4px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '500',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '8px 16px',
}

const viewAllSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
  padding: '24px',
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
}

const viewAllText = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0 0 12px 0',
}

const viewAllButton = {
  backgroundColor: '#059669',
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

export default NewOpportunityMatch