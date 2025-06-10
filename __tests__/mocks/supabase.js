// Mock for Supabase client

const createQueryBuilder = () => {
  const builder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    then: jest.fn((resolve) => resolve({ data: [], error: null })),
    throwOnError: jest.fn().mockReturnThis(),
  }
  
  // Make it thenable
  builder.then = function(resolve, reject) {
    const result = { data: [], error: null }
    if (resolve) resolve(result)
    return Promise.resolve(result)
  }
  
  return builder
}

const createSupabaseClient = () => ({
  auth: {
    getUser: jest.fn().mockResolvedValue({ 
      data: { user: null }, 
      error: null 
    }),
    getSession: jest.fn().mockResolvedValue({ 
      data: { session: null }, 
      error: null 
    }),
    signIn: jest.fn().mockResolvedValue({ 
      data: { user: null, session: null }, 
      error: null 
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn((callback) => {
      return {
        data: { subscription: { unsubscribe: jest.fn() } }
      }
    }),
    signInWithPassword: jest.fn().mockResolvedValue({ 
      data: { user: null, session: null }, 
      error: null 
    }),
    signUp: jest.fn().mockResolvedValue({ 
      data: { user: null, session: null }, 
      error: null 
    }),
    updateUser: jest.fn().mockResolvedValue({ 
      data: { user: null }, 
      error: null 
    }),
  },
  from: jest.fn((table) => createQueryBuilder()),
  storage: {
    from: jest.fn((bucket) => ({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ 
        data: { signedUrl: 'https://example.com/signed' }, 
        error: null 
      }),
      getPublicUrl: jest.fn().mockReturnValue({ 
        data: { publicUrl: 'https://example.com/public' } 
      }),
    }))
  },
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  functions: {
    invoke: jest.fn().mockResolvedValue({ data: null, error: null })
  },
  realtime: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn().mockReturnThis(),
    }))
  }
})

module.exports = {
  createClient: jest.fn(() => createSupabaseClient()),
  createServiceClient: jest.fn(() => createSupabaseClient()),
  createSupabaseClient,
  createQueryBuilder
}