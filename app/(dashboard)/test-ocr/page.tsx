import { Metadata } from 'next'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProcessDocumentsButton } from '@/components/dashboard/opportunities/process-documents-button'
import { FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Test OCR Processing | MedContractHub',
  description: 'Test Mistral OCR document processing',
}

export default async function TestOCRPage() {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get a sample opportunity with documents
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('*')
    .not('additional_info->resourceLinks', 'is', null)
    .limit(1)
    .single()

  if (!opportunity) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>No Test Opportunity Available</CardTitle>
            <CardDescription>
              Please save an opportunity with attached documents first.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const documentCount = opportunity.additional_info?.resourceLinks?.length || 0

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Test OCR Processing</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Test the Mistral OCR document processing functionality
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample Opportunity</CardTitle>
          <CardDescription>
            {opportunity.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-gray-500" />
              <span>{documentCount} document{documentCount !== 1 ? 's' : ''} available</span>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Test the OCR Processing:</h4>
              <ProcessDocumentsButton
                opportunityId={opportunity.id}
                documentCount={documentCount}
                onProcessComplete={() => {
                  console.log('OCR processing completed!')
                }}
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm">
              <h4 className="font-medium mb-1">What this does:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Downloads documents from SAM.gov</li>
                <li>Processes them with Mistral AI OCR</li>
                <li>Extracts product requirements and specifications</li>
                <li>Caches results for cost optimization</li>
                <li>Saves data to the database for sourcing</li>
              </ul>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-sm">
              <h4 className="font-medium mb-1 text-yellow-800 dark:text-yellow-200">⚠️ Important Note:</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Mistral's vision API currently only supports image files (PNG, JPG, etc). 
                PDF documents from SAM.gov will need to be converted to images first for OCR processing.
                In production, we would implement automatic PDF-to-image conversion.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>OCR Processing Notes</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert">
          <ul>
            <li>Processing cost: ~$0.04-0.05 per page</li>
            <li>Cached documents process instantly at no cost</li>
            <li>Results are saved to the contract_documents table</li>
            <li>Extracted requirements are saved to product_requirements table</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}