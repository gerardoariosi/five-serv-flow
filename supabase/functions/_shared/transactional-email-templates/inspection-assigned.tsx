import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "FiveServ"

interface InspectionAssignedProps {
  ins_number?: string
  property_address?: string
  visit_date?: string
  visit_time?: string
  assignee_name?: string
  detail_url?: string
}

const InspectionAssignedEmail = ({
  ins_number,
  property_address,
  visit_date,
  visit_time,
  assignee_name,
  detail_url,
}: InspectionAssignedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New inspection assigned: {ins_number ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>FS</Text>
        </Section>

        <Heading style={h1}>
          {assignee_name ? `Hi ${assignee_name},` : 'Hello,'}
        </Heading>
        <Text style={text}>
          A new inspection has been assigned to you. Please review the details below.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}><strong>Inspection:</strong> {ins_number ?? 'N/A'}</Text>
          <Text style={detailRow}><strong>Property:</strong> {property_address ?? 'N/A'}</Text>
          <Text style={detailRow}><strong>Date:</strong> {visit_date ?? 'TBD'}</Text>
          {visit_time ? (
            <Text style={detailRow}><strong>Time:</strong> {visit_time}</Text>
          ) : null}
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button style={button} href={detail_url ?? '#'}>
            View Inspection
          </Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>This is an automated message from {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InspectionAssignedEmail,
  subject: (data: Record<string, any>) => `New Inspection Assigned — ${data.ins_number ?? ''}`,
  displayName: 'Inspection Assigned',
  previewData: {
    ins_number: 'INS-2026-0001',
    property_address: '123 Main St, Springfield, MA 01103',
    visit_date: '2026-05-15',
    visit_time: '09:00',
    assignee_name: 'Alex',
    detail_url: 'https://example.com/inspections/abc-123',
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
const hr = { borderColor: '#eeeeee', margin: '20px 0' }
const footer = { fontSize: '11px', color: '#aaaaaa', lineHeight: '1.5', margin: '0' }
