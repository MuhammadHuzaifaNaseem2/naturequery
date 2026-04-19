// Quick test to verify email validation is working
import { validateEmailDomain } from './src/lib/email-validator'

async function quickTest() {
  console.log('Testing email validation...\n')

  const testEmail = 'dfdfdf@gmail.com'
  console.log(`Testing: ${testEmail}`)
  const result = await validateEmailDomain(testEmail)
  console.log(`Valid: ${result.valid}`)
  if (!result.valid) {
    console.log(`Error: ${result.error}`)
  }

  console.log('\n---\n')

  const fakeEmail = 'test@fakeeemaildomain12345.com'
  console.log(`Testing: ${fakeEmail}`)
  const result2 = await validateEmailDomain(fakeEmail)
  console.log(`Valid: ${result2.valid}`)
  if (!result2.valid) {
    console.log(`Error: ${result2.error}`)
  }
}

quickTest().catch(console.error)
