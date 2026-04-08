import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "FiveServ"

interface PMInspectionLinkProps {
  ins_number?: string
  property_name?: string
  visit_date?: string
  items_count?: number
  total_estimate?: string
  portal_url?: string
  link_expires_at?: string
}

const PMInspectionLinkEmail = ({
  ins_number,
  property_name,
  visit_date,
  items_count,
  total_estimate,
  portal_url,
  link_expires_at,
}: PMInspectionLinkProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Inspection {ins_number ?? ''} — review and approve repair items</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>FS</Text>
        </Section>

        <Heading style={h1}>Inspection Report Ready</Heading>

        <Text style={text}>
          An inspection has been completed and requires your review. Please review the items below and approve or decline each repair.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}><strong>Inspection:</strong> {ins_number ?? 'N/A'}</Text>
          <Text style={detailRow}><strong>Property:</strong> {property_name ?? 'N/A'}</Text>
          <Text style={detailRow}><strong>Visit Date:</strong> {visit_date ?? 'N/A'}</Text>
          <Text style={detailRow}><strong>Items Needing Repair:</strong> {items_count ?? 0}</Text>
          <Text style={detailRow}><strong>Total Estimate:</strong> ${total_estimate ?? '0.00'}</Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button style={button} href={portal_url ?? '#'}>
            Review Inspection
          </Button>
        </Section>

        <Text style={smallText}>
          This link will expire on {link_expires_at ?? 'N/A'}. You will need the access PIN provided by {SITE_NAME} to view the report.
        </Text>

        <Hr style={hr} />

        <Text style={footer}>
          This is an automated message from {SITE_NAME}. If you have questions, please reply to this email or contact your {SITE_NAME} representative.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PMInspectionLinkEmail,
  subject: (data: Record<string, any>) => `Inspection ${data.ins_number ?? ''} — Review Required`,
  displayName: 'PM Inspection Link',
  previewData: {
    ins_number: 'INS-2026-0001',
    property_name: '123 Main St',
    visit_date: 'April 8, 2026',
    items_count: 5,
    total_estimate: '1,250.00',
    portal_url: 'https://example.com/portal/abc-123',
    link_expires_at: 'June 7, 2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '20px' }
const logoText = { fontSize: '28px', fontWeight: 'bold', color: '#FFD700', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1A1A1A', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 20px' }
const detailsBox = { backgroundColor: '#f8f8f8', borderRadius: '8px', padding: '16px', margin: '0 0 20px' }
const detailRow = { fontSize: '13px', color: '#333333', lineHeight: '1.8', margin: '0' }
const button = {
  backgroundColor: '#FFD700',
  color: '#1A1A1A',
  fontWeight: 'bold',
  fontSize: '14px',
  padding: '12px 32px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}
const smallText = { fontSize: '12px', color: '#888888', lineHeight: '1.5', margin: '0 0 20px' }
const hr = { borderColor: '#eeeeee', margin: '20px 0' }
const footer = { fontSize: '11px', color: '#aaaaaa', lineHeight: '1.5', margin: '0' }
