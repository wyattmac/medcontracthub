#!/usr/bin/env tsx

console.log('🔧 Fixing Supabase MCP Server Authorization\n')

console.log('📋 The error indicates you need a Supabase Access Token for the MCP server.')
console.log('This is different from your project API keys.\n')

console.log('🔗 **How to Get Your Supabase Access Token:**\n')

console.log('1. **Go to Supabase Dashboard:**')
console.log('   https://supabase.com/dashboard/account/tokens\n')

console.log('2. **Create a Personal Access Token:**')
console.log('   - Click "Generate new token"')
console.log('   - Name: "Claude Code MCP Server"')
console.log('   - Scope: Select "All" or at minimum:')
console.log('     ✅ Read projects')
console.log('     ✅ Read organizations') 
console.log('     ✅ Write projects (for management operations)')
console.log('   - Expiration: Choose appropriate duration\n')

console.log('3. **Add Token to Environment:**')
console.log('   Add this line to your .env.local file:')
console.log('   SUPABASE_ACCESS_TOKEN=your_personal_access_token_here\n')

console.log('4. **Alternative: Set as System Environment Variable:**')
console.log('   export SUPABASE_ACCESS_TOKEN="your_personal_access_token_here"\n')

console.log('🔍 **Current Environment Check:**')

const hasProjectKeys = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const hasAccessToken = !!process.env.SUPABASE_ACCESS_TOKEN

console.log(`✅ Project API Keys: ${hasProjectKeys ? 'Configured' : 'Missing'}`)
console.log(`${hasAccessToken ? '✅' : '❌'} Personal Access Token: ${hasAccessToken ? 'Configured' : 'Missing'}`)

if (!hasAccessToken) {
  console.log('\n⚠️  **Action Required:**')
  console.log('You need to add SUPABASE_ACCESS_TOKEN to your environment.')
  console.log('This token is used by the MCP server to manage your Supabase projects.')
} else {
  console.log('\n✅ **All tokens configured!**')
  console.log('The MCP server should now be able to access your Supabase dashboard.')
}

console.log('\n🛡️  **Security Notes:**')
console.log('- Personal access tokens have broader permissions than project keys')
console.log('- Store them securely and never commit to version control')
console.log('- Consider setting expiration dates for security')
console.log('- You can revoke tokens anytime from the Supabase dashboard')

console.log('\n📖 **Documentation:**')
console.log('https://supabase.com/docs/guides/cli/managing-environments#access-tokens')