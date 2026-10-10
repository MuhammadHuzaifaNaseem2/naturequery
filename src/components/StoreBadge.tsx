/** Opens the Microsoft Store app on Windows, and the Store web page elsewhere. */
export const STORE_URL =
  'https://apps.microsoft.com/detail/9N6PJDWJRLFM?referrer=appbadge&mode=direct'

/**
 * The official "Download from the Microsoft Store" badge for NatureQuery Desktop, served
 * from this site because the content security policy blocks other image hosts.
 * The dark badge suits light themes and the light badge suits dark ones.
 */
export function StoreBadge({ className = 'h-14' }: { className?: string }) {
  return (
    <a
      href={STORE_URL}
      className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/badges/microsoft-store-dark.svg"
        alt="Download from the Microsoft Store"
        width={161}
        height={44}
        className={`${className} w-auto dark:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/badges/microsoft-store-light.svg"
        alt="Download from the Microsoft Store"
        width={161}
        height={44}
        className={`${className} hidden w-auto dark:block`}
      />
    </a>
  )
}
