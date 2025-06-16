/**
 * Mock Saved Opportunities Store
 * Uses localStorage to persist saved opportunities in development
 */

interface SavedOpportunity {
  id: string
  user_id: string
  opportunity_id: string
  opportunity: any
  is_pursuing: boolean
  notes: string
  tags: string[]
  reminder_date: string | null
  created_at: string
}

const STORAGE_KEY = 'mock_saved_opportunities'

export const mockSavedOpportunitiesStore = {
  getAll(userId: string): SavedOpportunity[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return []
      
      const all = JSON.parse(stored) as SavedOpportunity[]
      return all.filter(item => item.user_id === userId)
    } catch (error) {
      console.error('Error reading saved opportunities:', error)
      return []
    }
  },

  save(userId: string, opportunityId: string, opportunityData: any): void {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const all = stored ? JSON.parse(stored) as SavedOpportunity[] : []
      
      // Check if already saved
      const exists = all.find(
        item => item.user_id === userId && item.opportunity_id === opportunityId
      )
      
      if (!exists) {
        const newSaved: SavedOpportunity = {
          id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: userId,
          opportunity_id: opportunityId,
          opportunity: opportunityData,
          is_pursuing: false,
          notes: '',
          tags: [],
          reminder_date: null,
          created_at: new Date().toISOString()
        }
        
        all.push(newSaved)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      }
    } catch (error) {
      console.error('Error saving opportunity:', error)
    }
  },

  unsave(userId: string, opportunityId: string): void {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      
      const all = JSON.parse(stored) as SavedOpportunity[]
      const filtered = all.filter(
        item => !(item.user_id === userId && item.opportunity_id === opportunityId)
      )
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    } catch (error) {
      console.error('Error unsaving opportunity:', error)
    }
  },

  isSaved(userId: string, opportunityId: string): boolean {
    if (typeof window === 'undefined') return false
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return false
      
      const all = JSON.parse(stored) as SavedOpportunity[]
      return all.some(
        item => item.user_id === userId && item.opportunity_id === opportunityId
      )
    } catch (error) {
      console.error('Error checking saved status:', error)
      return false
    }
  }
}