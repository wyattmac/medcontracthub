'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'
import { getMedicalNAICSGrouped, getSpecificMedicalNAICS } from '@/lib/constants/medical-naics'

const CERTIFICATIONS = [
  { value: 'sdvosb', label: 'Service-Disabled Veteran-Owned Small Business' },
  { value: 'vosb', label: 'Veteran-Owned Small Business' },
  { value: 'wosb', label: 'Woman-Owned Small Business' },
  { value: 'edwosb', label: 'Economically Disadvantaged Woman-Owned Small Business' },
  { value: 'sdb', label: 'Small Disadvantaged Business' },
  { value: 'hubzone', label: 'HUBZone' },
]

// Get medical NAICS codes organized by category
const MEDICAL_NAICS_GROUPED = getMedicalNAICSGrouped()
const ALL_MEDICAL_NAICS = getSpecificMedicalNAICS()

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedNaicsCodes, setSelectedNaicsCodes] = useState<string[]>([])
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    title: '',
    company_name: '',
    naics_codes: '',
    certifications: [] as string[],
  })

  const handleNaicsToggle = (code: string) => {
    setSelectedNaicsCodes(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    )
  }

  const getSelectedNaicsDisplay = () => {
    if (selectedNaicsCodes.length === 0) return 'No NAICS codes selected'
    if (selectedNaicsCodes.length <= 3) {
      return selectedNaicsCodes.map(code => {
        const naics = ALL_MEDICAL_NAICS.find(n => n.code === code)
        return `${code} - ${naics?.title.substring(0, 40)}...`
      }).join(', ')
    }
    return `${selectedNaicsCodes.length} NAICS codes selected`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[Onboarding] Starting submission...')
    setLoading(true)

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('[Onboarding] User fetch error:', userError)
        throw userError
      }
      
      if (!user) {
        console.error('[Onboarding] No user found')
        throw new Error('No user found')
      }
      
      console.log('[Onboarding] User found:', user.email)

      // Create company
      console.log('[Onboarding] Creating company:', formData.company_name)
      const companyInsert = {
        name: formData.company_name,
        naics_codes: selectedNaicsCodes.length > 0 ? selectedNaicsCodes : formData.naics_codes.split(',').map(code => code.trim()),
        certifications: formData.certifications,
        subscription_plan: 'starter' as const,
        subscription_status: 'active'
      }
      
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert(companyInsert)
        .select()
        .single()
        
      type CompanyResponse = Database['public']['Tables']['companies']['Row']
      const createdCompany = company as CompanyResponse | null

      if (companyError) {
        console.error('[Onboarding] Company creation error:', companyError)
        throw companyError
      }
      
      console.log('[Onboarding] Company created:', createdCompany?.id)

      // Update profile
      console.log('[Onboarding] Updating profile for user:', user.id)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          title: formData.title,
          company_id: createdCompany?.id,
          onboarding_completed: true,
        })
        .eq('id', user.id)

      if (profileError) {
        console.error('[Onboarding] Profile update error:', profileError)
        throw profileError
      }

      console.log('[Onboarding] Profile updated successfully, redirecting to dashboard')
      router.push('/dashboard')
    } catch (error) {
      console.error('[Onboarding] Error during submission:', error)
      alert('Failed to complete onboarding. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Complete Your Profile
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Step {step} of 2
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Job Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Next
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
                  Company Name
                </label>
                <input
                  type="text"
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Your Medical Industry NAICS Codes
                </label>
                <div className="border border-gray-300 rounded-md p-3 mb-2 bg-gray-50">
                  <p className="text-sm text-gray-600">{getSelectedNaicsDisplay()}</p>
                </div>
                
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-4 space-y-4">
                  {/* Manufacturing */}
                  <div>
                    <h4 className="font-medium text-blue-600 mb-2">Manufacturing</h4>
                    <div className="space-y-1 ml-2">
                      {MEDICAL_NAICS_GROUPED.manufacturing?.slice(0, 8).map((naics) => (
                        <label key={naics.code} className="flex items-start space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedNaicsCodes.includes(naics.code)}
                            onChange={() => handleNaicsToggle(naics.code)}
                            className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-gray-700">
                            <span className="font-mono text-blue-600">{naics.code}</span> - {naics.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Wholesale */}
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">Wholesale & Distribution</h4>
                    <div className="space-y-1 ml-2">
                      {MEDICAL_NAICS_GROUPED.wholesale?.map((naics) => (
                        <label key={naics.code} className="flex items-start space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedNaicsCodes.includes(naics.code)}
                            onChange={() => handleNaicsToggle(naics.code)}
                            className="mt-0.5 h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-gray-700">
                            <span className="font-mono text-green-600">{naics.code}</span> - {naics.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Healthcare Services - Top 10 */}
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">Healthcare Services (Top 10)</h4>
                    <div className="space-y-1 ml-2">
                      {MEDICAL_NAICS_GROUPED.healthcare?.slice(0, 10).map((naics) => (
                        <label key={naics.code} className="flex items-start space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedNaicsCodes.includes(naics.code)}
                            onChange={() => handleNaicsToggle(naics.code)}
                            className="mt-0.5 h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                          />
                          <span className="text-gray-700">
                            <span className="font-mono text-red-600">{naics.code}</span> - {naics.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Research & Development */}
                  <div>
                    <h4 className="font-medium text-purple-600 mb-2">Research & Development</h4>
                    <div className="space-y-1 ml-2">
                      {MEDICAL_NAICS_GROUPED.research?.map((naics) => (
                        <label key={naics.code} className="flex items-start space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedNaicsCodes.includes(naics.code)}
                            onChange={() => handleNaicsToggle(naics.code)}
                            className="mt-0.5 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <span className="text-gray-700">
                            <span className="font-mono text-purple-600">{naics.code}</span> - {naics.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="mt-2">
                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                      Don&apos;t see your NAICS code? Enter manually
                    </summary>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={formData.naics_codes}
                        onChange={(e) => setFormData({ ...formData, naics_codes: e.target.value })}
                        placeholder="339112, 339113"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Enter comma-separated NAICS codes if yours aren&apos;t listed above
                      </p>
                    </div>
                  </details>
                </div>
                
                <p className="mt-2 text-sm text-gray-500">
                  Select the NAICS codes that best describe your medical business. This will help us match you with relevant federal contracting opportunities.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Certifications
                </label>
                <div className="mt-2 space-y-2">
                  {CERTIFICATIONS.map((cert) => (
                    <label key={cert.value} className="flex items-center">
                      <input
                        type="checkbox"
                        value={cert.value}
                        checked={formData.certifications.includes(cert.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              certifications: [...formData.certifications, cert.value],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              certifications: formData.certifications.filter(c => c !== cert.value),
                            })
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{cert.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || (selectedNaicsCodes.length === 0 && !formData.naics_codes.trim())}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}