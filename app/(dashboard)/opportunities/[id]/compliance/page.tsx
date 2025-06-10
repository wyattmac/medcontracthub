import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { ComplianceMatrixGenerator } from '@/components/dashboard/compliance/compliance-matrix-generator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Compliance Matrix Generator | MedContractHub',
  description: 'Generate compliance matrices for RFP requirements tracking',
}

interface CompliancePageProps {
  params: {
    id: string
  }
}

export default async function CompliancePage({ params }: CompliancePageProps) {
  const supabase = createServiceClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    notFound()
  }

  // Fetch opportunity details
  const { data: opportunity, error: oppError } = await supabase
    .from('opportunities')
    .select(`
      id,
      title,
      notice_id,
      agency,
      sub_agency,
      type,
      status,
      response_deadline,
      description,
      solicitation_number
    `)
    .eq('id', params.id)
    .single()

  if (oppError || !opportunity) {
    notFound()
  }

  // Check for existing compliance matrices
  const { data: existingMatrices } = await supabase
    .from('compliance_matrices')
    .select(`
      id,
      title,
      status,
      created_at,
      updated_at,
      total_requirements:compliance_requirements(count),
      completed_requirements:compliance_responses!inner(count)
    `)
    .eq('opportunity_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link 
              href={`/opportunities/${params.id}`}
              className="hover:text-foreground transition-colors"
            >
              {opportunity.title}
            </Link>
            <span>/</span>
            <span>Compliance Matrix</span>
          </div>
          <h1 className="text-2xl font-bold">Compliance Matrix Generator</h1>
        </div>
        
        <Button variant="outline" asChild>
          <Link href={`/opportunities/${params.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Opportunity
          </Link>
        </Button>
      </div>

      {/* Opportunity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Opportunity Details</CardTitle>
          <CardDescription>
            Generate and manage compliance matrices for this opportunity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notice ID</label>
              <p className="font-mono text-sm">{opportunity.notice_id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Agency</label>
              <p className="text-sm">{opportunity.agency}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <p className="text-sm">{opportunity.type}</p>
            </div>
            {opportunity.solicitation_number && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Solicitation</label>
                <p className="font-mono text-sm">{opportunity.solicitation_number}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <p className="text-sm capitalize">{opportunity.status}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Response Deadline</label>
              <p className="text-sm">
                {new Date(opportunity.response_deadline).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Matrices */}
      {existingMatrices && existingMatrices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Compliance Matrices</CardTitle>
            <CardDescription>
              You have {existingMatrices.length} compliance {existingMatrices.length === 1 ? 'matrix' : 'matrices'} for this opportunity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {existingMatrices.map((matrix: any) => (
                <div 
                  key={matrix.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{matrix.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(matrix.created_at).toLocaleDateString()} • 
                      {matrix.total_requirements?.[0]?.count || 0} requirements • 
                      Status: {matrix.status}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/opportunities/${params.id}/compliance?matrix=${matrix.id}`}>
                      View Matrix
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance Matrix Generator */}
      <ComplianceMatrixGenerator 
        opportunityId={opportunity.id}
        opportunityTitle={opportunity.title}
        onComplete={(_matrixId) => {
          // Refresh the page to show the new matrix
          window.location.reload()
        }}
      />
    </div>
  )
}