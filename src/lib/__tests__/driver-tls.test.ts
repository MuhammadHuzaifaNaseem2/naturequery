// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { DBCredentials } from '@/actions/db'
import { certificateProblem, clickHouseUrl, mysqlTls, postgresTls } from '../driver-tls'

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
