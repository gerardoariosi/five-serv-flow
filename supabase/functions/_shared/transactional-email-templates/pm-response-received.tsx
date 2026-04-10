import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "FiveServ"

interface PMResponseReceivedProps {
  ins_number?: string
  property_name?: string
  pm_name?: string
  items_approved?: number
  total_approved?: string
  detail_url?: string
}

const PMResponseReceivedEmail = ({
  ins_number,
  property_name,
  pm_name,
  items_approved,
  total_approved,
  detail_url,
}: PMResponseReceivedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>PM responded to inspection {ins_number ?? ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logoText}>FS</Text>
        </Section>

        <Heading style={h1}>PM Has Responded</Heading>

        <Text style={text}>
          The property manager has reviewed and submitted their response for the following inspection.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}><strong>Inspection:</strong> {ins_number ?? 'N/A'}</Text>
          <Text style={detailRow}><strong>Property:</strong> {property_name ?? 'N/A'}</Text>
          <Text style={detailRow}><strong>PM / Client:</strong> {pm_name ?? 'N/A'}</Text>
          <Text style={detailRow}><strong>Items Approved:</strong> {items_approved ?? 0}</Text>
          <Text style={detailRow}><strong>Total Approved:</strong> ${total_approved ?? '0.00'}</Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button style={button} href={detail_url ?? '#'}>
            View Inspection
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          This is an automated message from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PMResponseReceivedEmail,
  subject: (data: Record<string, any>) => `PM Response — Inspection ${data.ins_number ?? ''}`,
  displayName: 'PM Response Received',
  previewData: {
    ins_number: 'INS-2026-0001',
    property_name: '123 Main St',
    pm_name: 'Acme Property Mgmt',
    items_approved: 3,
    total_approved: '850.00',
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
