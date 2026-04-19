// Test script for email validation
// Run with: npx tsx test-email-validation.ts

import { validateEmailDomain } from './src/lib/email-validator'
import { writeFileSync } from 'fs'

async function testEmailValidation() {
    let output = 'Email Validation Test Results\n' + '='.repeat(50) + '\n\n'

    const testEmails = [
        { email: 'test@gmail.com', description: 'Valid Gmail address' },
        { email: 'user@yahoo.com', description: 'Valid Yahoo address' },
        { email: 'fake@nonexistentdomain12345.com', description: 'Fake domain' },
        { email: 'dfdfdf@gmail.com', description: 'Gmail with fake username' },
        { email: 'test@fakdomain999.xyz', description: 'Non-existent domain' },
    ]

    for (const { email, description } of testEmails) {
        output += `Testing: ${email}\n`
        output += `Description: ${description}\n`
        const result = await validateEmailDomain(email)
        output += `Result: ${result.valid ? '✓ VALID' : '✗ INVALID'}\n`
        if (!result.valid) {
            output += `Error: ${result.error}\n`
        }
        output += '\n'
    }

    console.log(output)
    writeFileSync('email-validation-results.txt', output)
    console.log('\nResults saved to email-validation-results.txt')
}

testEmailValidation().catch(console.error)
