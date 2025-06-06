#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkNoticeTypes() {
  console.log('🔍 Checking Notice Types in Database...\n');
  
  // Get unique notice types from additional_info where it exists
  const { data: noticeTypeData } = await supabase
    .from('opportunities')
    .select('additional_info')
    .not('additional_info', 'is', null)
    .limit(1000);
  
  const noticeTypes = new Set();
  const noticeTypeLabels = new Set();
  
  noticeTypeData?.forEach(row => {
    if (row.additional_info) {
      const info = row.additional_info;
      if (info.noticeType) noticeTypes.add(info.noticeType);
      if (info.type) noticeTypes.add(info.type);
      if (info.baseType) noticeTypes.add(info.baseType);
      
      // Check for descriptive notice type labels
      if (info.noticeTypeDescription) noticeTypeLabels.add(info.noticeTypeDescription);
    }
  });
  
  console.log('📋 Notice Types Found:');
  Array.from(noticeTypes).sort().forEach(type => {
    console.log(`   ${type}`);
  });
  
  console.log('\n📝 Notice Type Descriptions:');
  Array.from(noticeTypeLabels).sort().forEach(label => {
    console.log(`   ${label}`);
  });
  
  // Check what SAM.gov notice types should be included
  console.log('\n🎯 SAM.gov Standard Notice Types:');
  const standardTypes = [
    'o - Solicitation',
    'p - Presolicitation', 
    'r - Sources Sought',
    'g - Sale of Surplus Property',
    'k - Combined Synopsis/Solicitation',
    's - Special Notice',
    'i - Intent to Bundle Requirements',
    'a - Award Notice',
    'u - Justification and Authorization (J&A)',
    'c - Sources Sought for Setaside',
    'f - Fair Opportunity / Limited Sources Justification',
    'v - Vendor Announcement'
  ];
  
  standardTypes.forEach(type => console.log(`   ${type}`));
}

checkNoticeTypes();