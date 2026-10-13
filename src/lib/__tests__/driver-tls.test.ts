// @vitest-environment node
import { X509Certificate } from 'node:crypto'
import { rootCertificates } from 'node:tls'
import { describe, expect, it } from 'vitest'
import type { DBCredentials } from '@/actions/db'
import {
  certificateProblem,
  clickHouseUrl,
  isSupabaseHost,
  mysqlTls,
  postgresTls,
} from '../driver-tls'
import { SUPABASE_ROOT_CA } from '../supabase-certificate'

const creds = (extra: Partial<DBCredentials> = {}): DBCredentials => ({
  host: 'db.example.com',
  port: 5432,
  database: 'app',
  user: 'u',
  password: 'p',
  ...extra,
})

describe('certificate checks', () => {
  it('check the certificate when the connection asks for it', () => {
    expect(postgresTls(creds({ verifyCertificate: true }))).toEqual({ rejectUnauthorized: true })
    expect(mysqlTls(creds({ verifyCertificate: true }))).toEqual({
      rejectUnauthorized: true,
      verifyIdentity: true,
    })
  })

  it('keep older connections encrypted, trusting the certificate as it is', () => {
    expect(postgresTls(creds())).toEqual({ rejectUnauthorized: false })
    expect(postgresTls(creds({ verifyCertificate: false }))).toEqual({ rejectUnauthorized: false })
    expect(mysqlTls(creds())).toEqual({ rejectUnauthorized: false })
  })

  it('leave databases on this machine unencrypted', () => {
    expect(postgresTls(creds({ host: 'localhost', verifyCertificate: true }))).toBe(false)
    expect(mysqlTls(creds({ host: '127.0.0.1', verifyCertificate: true }))).toBeUndefined()
  })
})

describe('Supabase certificates', () => {
  it("trust Supabase's own authority, next to the public ones, for Supabase hosts", () => {
    for (const host of [
      'aws-0-ap-southeast-1.pooler.supabase.com',
      'db.abcdefghijkl.supabase.co',
    ]) {
      const tls = postgresTls(creds({ host, verifyCertificate: true }))
      expect(tls).toMatchObject({ rejectUnauthorized: true })
      const ca = (tls as { ca: string[] }).ca
      expect(ca).toContain(SUPABASE_ROOT_CA)
      expect(ca.length).toBe(rootCertificates.length + 1)
    }
  })

  it("never trust Supabase's authority for other servers", () => {
    for (const host of ['db.example.com', 'supabase.com.example.net', 'notsupabase.co']) {
      expect(isSupabaseHost(host), host).toBe(false)
      expect(postgresTls(creds({ host, verifyCertificate: true }))).toEqual({
        rejectUnauthorized: true,
      })
    }
  })

  it('keep a trusted Supabase connection as it was saved', () => {
    expect(
      postgresTls(creds({ host: 'aws-0-us-east-1.pooler.supabase.com', verifyCertificate: false }))
    ).toEqual({ rejectUnauthorized: false })
  })

  it('bundle the root Supabase publishes', () => {
    const root = new X509Certificate(SUPABASE_ROOT_CA)
    expect(root.ca).toBe(true)
    expect(root.subject).toContain('CN=Supabase Root 2021 CA')
    expect(root.fingerprint256).toBe(
      '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA'
    )
  })
})

describe('ClickHouse address', () => {
  it('uses HTTPS, on port 8443 unless another is given', () => {
    expect(clickHouseUrl(creds({ port: 0 }))).toBe('https://db.example.com:8443')
    expect(clickHouseUrl(creds({ port: 443 }))).toBe('https://db.example.com:443')
    expect(clickHouseUrl(creds({ host: '2606:4700::1111', port: 8443 }))).toBe(
      'https://[2606:4700::1111]:8443'
    )
  })

  it('uses plain HTTP only on the HTTP ports, which the hosted site refuses', () => {
    expect(clickHouseUrl(creds({ port: 8123 }))).toBe('http://db.example.com:8123')
  })
})

describe('certificate problems', () => {
  it('explain what to do in plain words', () => {
    for (const message of [
      'self-signed certificate in certificate chain',
      'unable to verify the first certificate',
      'unable to get local issuer certificate',
      "Hostname/IP does not match certificate's altnames: Host: db.example.com",
      'DEPTH_ZERO_SELF_SIGNED_CERT',
    ]) {
      expect(certificateProblem(new Error(message)), message).toMatch(
        /Trust this server's certificate/
      )
    }
  })

  it('leave other errors alone', () => {
    expect(certificateProblem(new Error('password authentication failed for user "u"'))).toBeNull()
  })
})
