const { Kafka } = require('kafkajs');
const { createClient } = require('@clickhouse/client');

async function runSimpleConsumer() {
  console.log('🚀 Starting simple consumer...');

  const kafka = new Kafka({
    clientId: 'simple-consumer',
    brokers: ['localhost:9092'],
  });

  const consumer = kafka.consumer({ 
    groupId: 'simple-analytics-group',
    sessionTimeout: 30000,
  });

  const clickhouse = createClient({
    host: 'http://localhost:8123',
    database: 'medcontract_analytics',
    username: 'analytics',
    password: 'analytics_password',
  });

  await consumer.connect();
  console.log('✅ Connected to Kafka');
  
  await consumer.subscribe({ 
    topic: 'contracts.opportunity.viewed', 
    fromBeginning: true 
  });
  console.log('✅ Subscribed to topic');

  let processedCount = 0;

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log(`\n📨 Processing event ${++processedCount}: ${event.eventId}`);
        
        // Simple insert with minimal fields
        // Use parameterized query to avoid SQL injection
        await clickhouse.insert({
          table: 'opportunity_views',
          values: [{
            event_id: event.eventId,
            timestamp: new Date().toISOString().replace('T', ' ').replace('Z', ''),
            opportunity_id: event.opportunityId,
            user_id: event.userId,
            session_id: event.sessionId,
            view_source: event.viewContext?.source || 'DIRECT_LINK',
            search_query: event.viewContext?.searchQuery || '',
            referrer: event.viewContext?.referrer || '',
            opportunity_title: event.opportunityMetadata?.title || '',
            agency: event.opportunityMetadata?.agency || '',
            naics_code: event.opportunityMetadata?.naicsCode || '',
            set_aside_type: event.opportunityMetadata?.setAsideType || '',
            user_agent: '',
            ip_hash: '',
            processing_time_ms: 0
          }],
          format: 'JSONEachRow',
        });
        console.log(`✅ Event written to ClickHouse!`);
        
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
    },
  });

  console.log('\n📊 Consumer is running...\n');
}

runSimpleConsumer().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});