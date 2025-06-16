import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useToast } from '@/components/ui/use-toast'

interface OCROptions {
  checkCommunity?: boolean
  shareToCommunity?: boolean
  model?: string
}

interface OCRResult {
  documentId: string
  pages: any[]
  extractedText: string
  requirements: any[]
  communityMatch?: {
    extractionId: string
    similarityScore: number
    timeSavedMs: number
    costSaved: number
  }
}

export function useCommunityOCR() {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  // Process document with community checking
  const processDocument = useMutation({
    mutationFn: async ({
      opportunityId,
      documentIndices,
      options = {}
    }: {
      opportunityId: string
      documentIndices?: number[]
      options?: OCROptions
    }) => {
      const response = await fetch('/api/ocr/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          processAllDocuments: !documentIndices,
          documentIndices,
          checkCommunity: options.checkCommunity ?? true,
          shareToCommunity: options.shareToCommunity ?? false
        })
      })

      if (!response.ok) {
        throw new Error('OCR processing failed')
      }

      return response.json()
    },
    onSuccess: (data) => {
      if (data.communityMatch) {
        toast({
          title: 'Used Community Extraction',
          description: `Saved ${(data.communityMatch.timeSavedMs / 1000).toFixed(1)}s and $${data.communityMatch.costSaved.toFixed(3)} by using community data`
        })
      } else {
        toast({
          title: 'OCR Processing Complete',
          description: `Processed ${data.documentsProcessed} documents`
        })
      }
    },
    onError: (error) => {
      toast({
        title: 'OCR Processing Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Share extraction to community
  const shareExtraction = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch('/api/ocr/community/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          confirmAnonymized: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to share extraction')
      }

      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: 'Thank you for sharing!',
        description: data.rewards?.message || 'Your extraction has been shared with the community'
      })
    },
    onError: (error) => {
      toast({
        title: 'Sharing Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Search community extractions
  const searchCommunity = useMutation({
    mutationFn: async (textSample: string) => {
      const response = await fetch('/api/ocr/community/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textSample,
          similarityThreshold: 0.8
        })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      return response.json()
    }
  })

  // Get community stats
  const { data: communityStats, isLoading: statsLoading } = useQuery({
    queryKey: ['community-ocr-stats'],
    queryFn: async () => {
      const response = await fetch('/api/ocr/community/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    processDocument: processDocument.mutate,
    shareExtraction: shareExtraction.mutate,
    searchCommunity: searchCommunity.mutate,
    isProcessing: processDocument.isPending || isProcessing,
    isSharing: shareExtraction.isPending,
    isSearching: searchCommunity.isPending,
    searchResults: searchCommunity.data,
    communityStats,
    statsLoading
  }
}