/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoHeader}>
          <span style={{color:'#FFD700',fontWeight:'bold',fontSize:'24px',fontFamily:'Arial,sans-serif'}}>F</span>
          <span style={{color:'#FFFFFF',fontWeight:'bold',fontSize:'24px',fontFamily:'Arial,sans-serif'}}>iveServ</span>
          <div style={{color:'#FFFFFF',fontSize:'9px',letterSpacing:'3px',fontFamily:'Arial,sans-serif',marginTop:'2px'}}>PROPERTY SOLUTIONS</div>
        </div>
        <Hr style={hr} />
        <Heading style={h1}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
        <Text style={tagline}>One Team. One Call. Done.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logoHeader = { backgroundColor: '#1A1A1A', padding: '20px 25px', margin: '-20px -25px 0' }
const hr = { borderColor: '#FFD700', margin: '10px 0 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#555555', lineHeight: '1.5', margin: '0 0 25px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1A1A1A',
  backgroundColor: '#FFF8DC',
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #FFD700',
  display: 'inline-block' as const,
  margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
const tagline = { fontSize: '11px', color: '#B8960C', fontStyle: 'italic' as const, margin: '10px 0 0' }
