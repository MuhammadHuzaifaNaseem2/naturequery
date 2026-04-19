import { NextResponse } from 'next/server'

interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function apiError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export function apiPaginated<T>(data: T[], meta: PaginationMeta, status = 200) {
  return NextResponse.json({ success: true, data, meta }, { status })
}
