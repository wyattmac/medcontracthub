#!/usr/bin/env tsx

/**
 * Test script to validate end-to-end event flow
 * Tests: App → Kafka → Analytics Service → ClickHouse
 */

import { Kafka } from 'kafkajs';
import { createClient } from '@clickhouse/client';

const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const CLICKHOUSE_HOST = process.env.CLICKHOUSE_HOST || 'localhost';

async function testEventFlow() {
  console.log('🧪 Testing Cloud-Native Event Flow...\n');

  // 1. Test Kafka connectivity
  console.log('1️⃣ Testing Kafka connectivity...');
  const kafka = new Kafka({
    clientId: 'event-flow-test',
    brokers: KAFKA_BROKERS,
  });

  const admin = kafka.admin();
  
  try {
    await admin.connect();
    const topics = await admin.listTopics();
    console.log('✅ Kafka connected. Topics:', topics.filter(t => t.includes('contracts')));
    await admin.disconnect();
  } catch (error) {
    console.error('❌ Kafka connection failed:', error);
    return;
  }

  // 2. Test publishing an event
  console.log('\n2️⃣ Publishing test event...');
  const producer = kafka.producer();
  
  try {
    await producer.connect();
    
    const testEvent = {
      eventId: `test-${Date.now()}`,
      timestamp: Date.now(),
      opportunityId: 'test-opp-123',
      userId: 'test-user-456',
      sessionId: 'test-session-789',
      viewContext: {
        source: 'SEARCH',
        searchQuery: 'medical supplies',
        referrer: 'https://medcontracthub.com/search'
      },
      opportunityMetadata: {
        title: 'Test Medical Supplies Contract',
        agency: 'Test VA Hospital',
        naicsCode: '423450',
        setAsideType: 'Small Business',
        responseDeadline: Date.now() + 30 * 24 * 60 * 60 * 1000
      }
    };

    await producer.send({
      topic: 'contracts.opportunity.viewed',
      messages: [{
        key: testEvent.opportunityId,
        value: JSON.stringify(testEvent),
        headers: {
          'event-type': 'test',
          'event-id': testEvent.eventId,
        }
      }]
    });

    console.log('✅ Event published:', testEvent.eventId);
    await producer.disconnect();
  } catch (error) {
    console.error('❌ Event publishing failed:', error);
    return;
  }

  // 3. Wait for processing
  console.log('\n3️⃣ Waiting for Analytics Service to process...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 4. Query ClickHouse
  console.log('\n4️⃣ Querying ClickHouse for processed events...');
  const clickhouse = createClient({
    host: `http://${CLICKHOUSE_HOST}:8123`,
    database: 'medcontract_analytics',
    username: 'analytics',
    password: 'analytics_password',
  });

  try {
    // Check if event was written
    const result = await clickhouse.query({
      query: `
        SELECT 
          event_id,
          timestamp,
          opportunity_id,
          user_id,
          view_source
        FROM opportunity_views
        WHERE opportunity_id = 'test-opp-123'
        ORDER BY timestamp DESC
        LIMIT 5
      `,
      format: 'JSONEachRow',
    });

    const events = await result.json();
    console.log('✅ Events in ClickHouse:', events);

    // Check real-time metrics
    const metricsResult = await clickhouse.query({
      query: `
        SELECT
          toStartOfMinute(timestamp) as minute,
          count() as views,
          uniq(user_id) as unique_users
        FROM opportunity_views
        WHERE timestamp >= now() - INTERVAL 10 MINUTE
        GROUP BY minute
        ORDER BY minute DESC
        LIMIT 5
      `,
      format: 'JSONEachRow',
    });

    const metrics = await metricsResult.json();
    console.log('\n📊 Real-time metrics:', metrics);

  } catch (error) {
    console.error('❌ ClickHouse query failed:', error);
  }

  // 5. Test Analytics Service health
  console.log('\n5️⃣ Checking Analytics Service health...');
  try {
    const response = await fetch('http://localhost:8300/health');
    const health = await response.json();
    console.log('✅ Analytics Service health:', health);

    // Check SLOs
    const sloResponse = await fetch('http://localhost:8300/slo');
    const slos = await sloResponse.json();
    console.log('📈 SLO Status:', JSON.stringify(slos, null, 2));
  } catch (error) {
    console.error('❌ Analytics Service not reachable:', error);
  }

  console.log('\n✨ Event flow test completed!');
}

// Run the test
testEventFlow().catch(console.error);