import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  console.log('Button clicked:', body)
  
  return NextResponse.json({ 
    success: true, 
    message: `${body.buttonType} button clicked successfully`,
    timestamp: new Date().toISOString()
  })
}