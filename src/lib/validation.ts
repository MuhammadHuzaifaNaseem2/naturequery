/**
 * Input validation schemas using Zod
 */

import { z } from 'zod'

// ─── Common Schemas ──────────────────────────────────────────────────

export const IdSchema = z.string().cuid('Invalid identifier format')
export const OptionalIdSchema = z.string().cuid('Invalid identifier format').optional().nullable()

export const PaginationSchema = z.object({
    page: z.number().int().min(1).optional().default(1),
    pageSize: z.number().int().min(1).max(100).optional().default(20),
    search: z.string().max(100).optional().nullable(),
})

// ─── Export Validation ───────────────────────────────────────────────

export const ExportToExcelSchema = z.object({
    rows: z.array(z.record(z.string(), z.unknown())).min(1),
    fields: z.array(z.string()).min(1),
    filename: z.string()
        .min(1, 'Filename is required')
        .max(255, 'Filename must not exceed 255 characters')
        .regex(/^[a-zA-Z0-9_\-. ]+$/, 'Filename contains invalid characters')
        .refine(
            (name) => !name.startsWith('.'),
            'Filename cannot start with a dot'
        ),
    title: z.string().optional(),
})

export const ExportToCSVSchema = z.object({
    rows: z.array(z.record(z.string(), z.unknown())).min(1),
    fields: z.array(z.string()).min(1),
    filename: z.string()
        .min(1, 'Filename is required')
        .max(255, 'Filename must not exceed 255 characters')
        .regex(/^[a-zA-Z0-9_\-. ]+$/, 'Filename contains invalid characters')
        .refine(
            (name) => !name.startsWith('.'),
            'Filename cannot start with a dot'
        ),
})

export type ExportToExcelInput = z.infer<typeof ExportToExcelSchema>
export type ExportToCSVInput = z.infer<typeof ExportToCSVSchema>

// ─── Database Credentials Validation ─────────────────────────────────

export const DBCredentialsSchema = z.object({
    name: z.string().min(1, 'Display name is required').max(100),
    host: z.string().min(1, 'Host is required').max(255),
    port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
    database: z.string().min(1, 'Database name is required').max(255),
    user: z.string().min(1, 'Username is required').max(255),
    password: z.string().min(1, 'Password is required').max(1000, 'Password is too long'),
    dbType: z.enum([
        'postgresql', 'mysql', 'mariadb', 'sqlite', 'sqlserver',
        'oracle', 'redshift', 'cockroachdb', 'clickhouse',
        'snowflake', 'bigquery', 'neon', 'planetscale', 'mongodb',
    ]).default('postgresql'),
    ssl: z.boolean().optional().default(false),
    teamId: OptionalIdSchema,
})

export type DBCredentialsInput = z.infer<typeof DBCredentialsSchema>

// ─── Query Validation ────────────────────────────────────────────────

export const GenerateSQLSchema = z.object({
    question: z.string()
        .min(3, 'Question must be at least 3 characters')
        .max(1000, 'Question must not exceed 1000 characters'),
    schema: z.object({
        tables: z.array(z.object({
            tableName: z.string(),
            columns: z.array(z.object({
                name: z.string(),
                type: z.string(),
                nullable: z.boolean(),
                defaultValue: z.union([z.string(), z.null()]),
                isPrimaryKey: z.boolean(),
            })),
        })),
    }),
})

export type GenerateSQLInput = z.infer<typeof GenerateSQLSchema>

// ─── API v1 Validation ──────────────────────────────────────────────

export const SaveQueryApiSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().max(1000).optional().nullable(),
    question: z.string().min(1, 'Question is required').max(5000),
    sql: z.string().max(50000).optional().nullable(), // optional for templates
    connectionId: OptionalIdSchema,
    connectionName: z.string().max(200).optional().nullable(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    isPublic: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
})

export const UpdateQuerySchema = z.object({
    id: IdSchema,
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    isPublic: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
})


export type SaveQueryApiInput = z.infer<typeof SaveQueryApiSchema>

export const GenerateQueryApiInputSchema = z.object({
    question: z.string().min(3, 'Question must be at least 3 characters').max(1000),
    connectionId: z.string().min(1, 'connectionId is required'),
})

export const ExecuteQueryApiSchema = z.object({
    connectionId: z.string().min(1, 'connectionId is required'),
    sql: z.string().min(1, 'SQL query is required').max(50000),
})

export type GenerateQueryApiInput = z.infer<typeof GenerateQueryApiInputSchema>
export type ExecuteQueryApiInput = z.infer<typeof ExecuteQueryApiSchema>

// ─── Team Validation ─────────────────────────────────────────────────

export const CreateTeamSchema = z.object({
    name: z.string().min(1, 'Team name is required').max(100),
    description: z.string().max(500).optional().nullable(),
})

export const UpdateTeamSchema = z.object({
    teamId: IdSchema,
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
})

export const TeamInviteSchema = z.object({
    teamId: IdSchema,
    email: z.string().email('Invalid email address'),
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
})

export const UpdateMemberRoleSchema = z.object({
    teamId: IdSchema,
    memberId: IdSchema,
    role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
})

export const RespondToInviteSchema = z.object({
    teamId: IdSchema,
    accept: z.boolean(),
})

// ─── Admin Validation ────────────────────────────────────────────────

export const UpdateUserRoleSchema = z.object({
    userId: IdSchema,
    newRole: z.enum(['ADMIN', 'ANALYST', 'VIEWER']),
})

// ─── Notification Validation ─────────────────────────────────────────

export const NotificationIdSchema = z.object({
    id: IdSchema,
})

// ─── Helper Functions ────────────────────────────────────────────────

/**
 * Validate input against a Zod schema and return formatted errors
 */
export function validateInput<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data)

    if (result.success) {
        return { success: true, data: result.data }
    }

    // Format Zod errors into a readable string
    const errors = result.error.issues.map((err: z.ZodIssue) => {
        const path = err.path.join('.')
        return path ? `${path}: ${err.message}` : err.message
    })

    return {
        success: false,
        error: errors.join('; '),
    }
}
