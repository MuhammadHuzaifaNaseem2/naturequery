import { resolveMx } from 'dns/promises'

/**
 * Validates if an email address has a valid domain with MX records
 * This ensures the domain can receive emails
 */
export async function validateEmailDomain(email: string): Promise<{ valid: boolean; error?: string }> {
    try {
        // Extract domain from email
        const domain = email.split('@')[1]

        if (!domain) {
            return { valid: false, error: 'Invalid email format' }
        }

        // Check for common disposable email providers (optional blocklist)
        const disposableDomains = [
            'tempmail.com',
            'throwaway.email',
            'guerrillamail.com',
            '10minutemail.com',
            'mailinator.com',
        ]

        if (disposableDomains.includes(domain.toLowerCase())) {
            return { valid: false, error: 'Disposable email addresses are not allowed' }
        }

        // Check if domain has valid MX records
        // Fail open in dev or if DNS is unavailable — format already validated by Zod
        try {
            const mxRecords = await resolveMx(domain)

            if (!mxRecords || mxRecords.length === 0) {
                return { valid: false, error: 'Email domain cannot receive emails' }
            }

            return { valid: true }
        } catch (dnsError) {
            // DNS lookup failed — could be network issue in dev, fail open to not block real users
            console.warn('DNS MX lookup failed for domain:', domain, '— allowing registration')
            return { valid: true }
        }
    } catch (error) {
        console.error('Email validation error:', error)
        return { valid: false, error: 'Unable to validate email address' }
    }
}

/**
 * Validates email format using regex (basic check)
 * Note: Zod already handles this, but keeping for reference
 */
export function validateEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}
