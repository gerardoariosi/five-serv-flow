import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'FiveServ Operations Hub'

interface InspectionReportProps {
  ins_number?: string
  property_name?: string
  report_type?: string
  visit_date?: string
  download_url?: string
}

const InspectionReportEmail = ({
  ins_number = 'INS-0000',
  property_name = 'N/A',
  report_type = 'Inspection Report',
  visit_date = 'N/A',
  download_url = '#',
}: InspectionReportProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Inspection Report: {ins_number} — {report_type}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={brandHeading}>
            <span style={{ color: '#FFD700' }}>F</span>iveServ
          </Heading>
          <Text style={tagline}>ONE TEAM. ONE CALL. DONE.</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Inspection Report</Heading>
        <Text style={text}>
          Please find the inspection report for <strong>{ins_number}</strong>.
        </Text>
        <Section style={infoBox}>
          <Text style={infoRow}><strong>Property:</strong> {property_name}</Text>
          <Text style={infoRow}><strong>Report Type:</strong> {report_type}</Text>
          <Text style={infoRow}><strong>Visit Date:</strong> {visit_date}</Text>
        </Section>
        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button style={button} href={download_url}>
            Download Report PDF
          </Button>
        </Section>
        <Text style={footerNote}>
          This download link will expire in 7 days. If you need the report after that,
          please contact FiveServ.
        </Text>
        <Hr style={divider} />
        <Text style={footer}>
          {SITE_NAME} — One Team. One Call. Done.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InspectionReportEmail,
  subject: (data: Record<string, any>) =>
    `Inspection Report: ${data.ins_number ?? 'INS'} — ${data.report_type ?? 'Report'}`,
  displayName: 'Inspection Report Download',
  previewData: {
    ins_number: 'INS-2026-0042',
    property_name: '123 Main St',
    report_type: 'FiveServ Internal Report',
    visit_date: '2026-04-10',
    download_url: 'https://example.com/download',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const headerSection = { textAlign: 'center' as const, marginBottom: '10px' }
const brandHeading = { fontSize: '28px', fontWeight: 'bold' as const, color: '#000000', margin: '0' }
const tagline = { fontSize: '10px', letterSpacing: '2px', color: '#FFD700', margin: '4px 0 0' }
const divider = { borderColor: '#e5e5e5', margin: '20px 0' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 15px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 20px' }
const infoBox = { backgroundColor: '#f9f9f9', borderRadius: '6px', padding: '15px', margin: '0 0 10px' }
const infoRow = { fontSize: '13px', color: '#555555', margin: '4px 0' }
const button = {
  backgroundColor: '#FFD700',
  color: '#000000',
  fontWeight: 'bold' as const,
  padding: '14px 30px',
  borderRadius: '6px',
  fontSize: '14px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footerNote = { fontSize: '12px', color: '#999999', margin: '0 0 20px', textAlign: 'center' as const }
const footer = { fontSize: '11px', color: '#aaaaaa', textAlign: 'center' as const, margin: '0' }
