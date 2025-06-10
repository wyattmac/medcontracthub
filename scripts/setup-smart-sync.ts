#!/usr/bin/env tsx
/**
 * Smart Sync Setup for SAM.gov Opportunities
 * Distributes 1000 daily API calls evenly throughout the day
 */

import { createClient } from '@supabase/supabase-js';

const DAILY_QUOTA = 1000;
const HOURS_IN_DAY = 24;
const CALLS_PER_HOUR = Math.floor(DAILY_QUOTA / HOURS_IN_DAY); // ~41 calls per hour
const BUFFER_CALLS = 100; // Keep 100 calls as emergency buffer

async function setupSmartSync() {
  console.log('🧠 Smart SAM.gov Sync Configuration\n');
  
  console.log('📊 Daily Quota Distribution:');
  console.log(`   Total daily quota: ${DAILY_QUOTA} calls`);
  console.log(`   Emergency buffer: ${BUFFER_CALLS} calls`);
  console.log(`   Available for sync: ${DAILY_QUOTA - BUFFER_CALLS} calls`);
  console.log(`   Calls per hour: ${CALLS_PER_HOUR} calls`);
  
  console.log('\n📅 Recommended Sync Schedule:');
  console.log('   Every hour: Fetch 40 new opportunities');
  console.log('   Focus hours: 2 AM - 6 AM (low usage time)');
  console.log('   Update existing: Every 4 hours');
  
  console.log('\n🎯 Sync Strategy:');
  console.log('   1. Use aggressive caching (5-15 minute TTL)');
  console.log('   2. Prioritize medical NAICS codes:');
  console.log('      - 339112: Surgical and Medical Instruments');
  console.log('      - 339113: Surgical Appliance and Supplies');
  console.log('      - 423450: Medical Equipment Merchant Wholesalers');
  console.log('      - 621999: Miscellaneous Ambulatory Health Care');
  console.log('   3. Fetch attachments only when needed');
  console.log('   4. Use database-first approach for searches');
  
  console.log('\n⚙️  Implementation:');
  console.log('   1. Cron job: */60 * * * * (every hour)');
  console.log('   2. Each sync fetches 10 opportunities per NAICS code');
  console.log('   3. Total: 40 opportunities per hour = 960 per day');
  console.log('   4. Leaves 40 calls for user searches and attachments');
  
  // Create a cron configuration
  const cronConfig = {
    schedule: '0 * * * *', // Every hour on the hour
    tasks: [
      {
        name: 'hourly-opportunity-sync',
        endpoint: '/api/sync/smart',
        config: {
          naicsCodes: ['339112', '339113', '423450', '621999'],
          limitPerNaics: 10,
          maxTotalCalls: CALLS_PER_HOUR,
          cacheStrategy: 'aggressive',
          prioritizeNew: true
        }
      }
    ]
  };
  
  console.log('\n📝 Cron Configuration:');
  console.log(JSON.stringify(cronConfig, null, 2));
  
  console.log('\n💡 Additional Recommendations:');
  console.log('   • Enable Redis caching for all API responses');
  console.log('   • Use webhook notifications for critical updates');
  console.log('   • Implement user-specific quota tracking');
  console.log('   • Consider upgrading SAM.gov API tier if needed');
  
  console.log('\n🚀 To implement this strategy:');
  console.log('   1. Set up the cron job in your server');
  console.log('   2. Deploy the smart sync endpoint');
  console.log('   3. Monitor quota usage daily');
  console.log('   4. Adjust limits based on actual usage patterns');
}

// Run setup
setupSmartSync().catch(console.error);