'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { 
  Users, 
  Share2, 
  Clock, 
  DollarSign, 
  Trophy,
  CheckCircle,
  AlertCircle,
  Search
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { formatDistanceToNow } from 'date-fns'

interface CommunityStats {
  totalExtractions: number
  uniqueDocuments: number
  totalUsers: number
  totalSaves: {
    timeSavedHours: number
    costSaved: number
    apiCallsSaved: number
  }
  topContributors: Array<{
    userId: string
    username: string
    contributionScore: number
    extractionsShared: number
  }>
  userStats?: {
    contributionScore: number
    extractionsShared: number
    extractionsUsed: number
    rankPercentile: number
  }
}

interface CommunityExtraction {
  extractionId: string
  similarityScore: number
  confidenceScore: number
  usageCount: number
  extractedText: string
  structuredData: any
  requirements: any[]
}

export function CommunityOCRPanel() {
  const { toast } = useToast()
  const [searchText, setSearchText] = useState('')
  const [selectedExtraction, setSelectedExtraction] = useState<CommunityExtraction | null>(null)

  // Fetch community stats
  const { data: stats, isLoading: statsLoading } = useQuery<CommunityStats>({
    queryKey: ['community-ocr-stats'],
    queryFn: async () => {
      const response = await fetch('/api/ocr/community/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    refetchInterval: 60000 // Refresh every minute
  })

  // Search community extractions
  const searchMutation = useMutation({
    mutationFn: async (textSample: string) => {
      const response = await fetch('/api/ocr/community/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textSample })
      })
      if (!response.ok) throw new Error('Search failed')
      return response.json()
    },
    onSuccess: (data) => {
      if (data.extractions.length === 0) {
        toast({
          title: 'No matches found',
          description: 'No similar documents found in the community database'
        })
      }
    }
  })

  const handleSearch = () => {
    if (searchText.length < 50) {
      toast({
        title: 'Text too short',
        description: 'Please provide at least 50 characters for accurate matching',
        variant: 'destructive'
      })
      return
    }
    searchMutation.mutate(searchText)
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Extractions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalExtractions.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.uniqueDocuments || 0} unique documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalSaves.timeSavedHours.toFixed(1) || '0'}h
            </div>
            <p className="text-xs text-muted-foreground">
              Processing time saved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Saved</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.totalSaves.costSaved.toFixed(2) || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              In OCR API costs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.userStats?.contributionScore || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Top {stats?.userStats?.rankPercentile || 100}% contributor
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="search" className="space-y-4">
        <TabsList>
          <TabsTrigger value="search">Search Extractions</TabsTrigger>
          <TabsTrigger value="contributors">Top Contributors</TabsTrigger>
          <TabsTrigger value="my-stats">My Contributions</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Community Extractions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>How it works</AlertTitle>
                <AlertDescription>
                  Paste a sample of your document text (at least 50 characters) to find 
                  similar documents that have already been processed by the community.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[100px] p-3 border rounded-md"
                  placeholder="Paste document text sample here..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {searchText.length} characters
                  </span>
                  <Button 
                    onClick={handleSearch}
                    disabled={searchText.length < 50 || searchMutation.isPending}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Search Community
                  </Button>
                </div>
              </div>

              {searchMutation.data?.extractions && (
                <div className="space-y-3">
                  <h3 className="font-semibold">
                    Found {searchMutation.data.extractions.length} similar documents
                  </h3>
                  {searchMutation.data.extractions.map((extraction: CommunityExtraction) => (
                    <Card 
                      key={extraction.extractionId}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setSelectedExtraction(extraction)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {Math.round(extraction.similarityScore * 100)}% match
                              </Badge>
                              <Badge variant="outline">
                                {extraction.usageCount} uses
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {extraction.extractedText.substring(0, 150)}...
                            </p>
                          </div>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contributors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Contributors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.topContributors.map((contributor, index) => (
                  <div key={contributor.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{contributor.username}</p>
                        <p className="text-sm text-muted-foreground">
                          {contributor.extractionsShared} documents shared
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{contributor.contributionScore}</p>
                      <p className="text-sm text-muted-foreground">points</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Contribution Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats?.userStats ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{stats.userStats.extractionsShared}</p>
                      <p className="text-sm text-muted-foreground">Documents Shared</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{stats.userStats.extractionsUsed}</p>
                      <p className="text-sm text-muted-foreground">Times Used</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{stats.userStats.contributionScore}</p>
                      <p className="text-sm text-muted-foreground">Total Points</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Contributor Rank</span>
                      <span className="font-medium">Top {stats.userStats.rankPercentile}%</span>
                    </div>
                    <Progress value={stats.userStats.rankPercentile} />
                  </div>

                  <Alert>
                    <Trophy className="h-4 w-4" />
                    <AlertTitle>Keep Contributing!</AlertTitle>
                    <AlertDescription>
                      Share more OCR extractions to help the community and earn rewards.
                      Each shared document helps others save time and reduces costs.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <Alert>
                  <Share2 className="h-4 w-4" />
                  <AlertTitle>Start Contributing</AlertTitle>
                  <AlertDescription>
                    Share your first OCR extraction to start earning contribution points
                    and help build the community database.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}