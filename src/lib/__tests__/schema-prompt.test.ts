import { describe, expect, it } from 'vitest'
import { enumValuesText, formatDesktopSchema } from '@/lib/desktop/prompts'
import { formatSchemaForPrompt } from '@/lib/schema-utils'

describe('enum values in the schema the AI reads', () => {
  it('lists the values, quoted as SQL strings', () => {
    expect(enumValuesText(['student', "o'brien"])).toBe(" (one of 'student', 'o''brien')")
    expect(enumValuesText(undefined)).toBe('')
    expect(enumValuesText([])).toBe('')
  })

  it('lists at most 30 values', () => {
    const many = Array.from({ length: 45 }, (_, i) => `v${i}`)
    expect(enumValuesText(many)).toMatch(/'v29', and 15 more\)$/)
  })

  it('shows them on the website and in the desktop schema text', () => {
    const web = formatSchemaForPrompt({
      tables: [
        {
          tableName: 'profiles',
          columns: [
            {
              name: 'role',
              type: 'user_role',
              nullable: false,
              defaultValue: null,
              isPrimaryKey: false,
              values: ['student', 'teacher'],
            },
          ],
        },
      ],
    })
    expect(web).toContain("- role: user_role (one of 'student', 'teacher') [NOT NULL]")

    const desktop = formatDesktopSchema(
      [
        {
          name: 'public.profiles',
          columns: [{ name: 'role', type: 'user_role', values: ['student'] }],
        },
      ],
      'postgresql'
    )
    expect(desktop).toContain("role: user_role (one of 'student')")
  })
})
