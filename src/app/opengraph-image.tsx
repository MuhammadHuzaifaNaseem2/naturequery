import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'NatureQuery - Natural Language to SQL'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4338ca 60%, #6366f1 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.9" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" fill="none" opacity="0.7" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" fill="none" opacity="0.8" />
            </svg>
          </div>
          <span
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: 'white',
              letterSpacing: '-1px',
            }}
          >
            NatureQuery
          </span>
        </div>
        <p
          style={{
            fontSize: '28px',
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: '1.4',
          }}
        >
          Ask your database in plain English.
          <br />
          Get instant SQL queries and insights.
        </p>
        <div
          style={{
            marginTop: '40px',
            padding: '12px 32px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '18px',
          }}
        >
          PostgreSQL &bull; MySQL &bull; SQLite
        </div>
      </div>
    ),
    { ...size }
  )
}
