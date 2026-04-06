/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

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
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoHeader}>
          <span style={{color:'#FFD700',fontWeight:'bold',fontSize:'24px',fontFamily:'Arial,sans-serif'}}>F</span>
          <span style={{color:'#FFFFFF',fontWeight:'bold',fontSize:'24px',fontFamily:'Arial,sans-serif'}}>iveServ</span>
          <div style={{color:'#FFFFFF',fontSize:'9px',letterSpacing:'3px',fontFamily:'Arial,sans-serif',marginTop:'2px'}}>PROPERTY SOLUTIONS</div>
        </div>
        <Hr style={hr} />
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Welcome to{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) by clicking the button below:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verify Email
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
        <Text style={tagline}>One Team. One Call. Done.</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const logoHeader = { backgroundColor: '#1A1A1A', padding: '20px 25px', margin: '-20px -25px 0' }
const hr = { borderColor: '#FFD700', margin: '10px 0 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#555555', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: '#B8960C', textDecoration: 'underline' }
const button = {
  backgroundColor: '#FFD700',
  color: '#1A1A1A',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
const tagline = { fontSize: '11px', color: '#B8960C', fontStyle: 'italic' as const, margin: '10px 0 0' }
