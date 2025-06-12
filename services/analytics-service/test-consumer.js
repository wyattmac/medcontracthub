const { Kafka } = require('kafkajs');
const { createClient } = require('@clickhouse/client');

async function runTestConsumer() {
  console.log('🚀 Starting test Analytics Service consumer...');

  // Kafka setup
  const kafka = new Kafka({
    clientId: 'analytics-service-test',
    brokers: ['localhost:9092'],
  });

  const consumer = kafka.consumer({ groupId: 'analytics-test-group' });

  // ClickHouse setup
  const clickhouse = createClient({
    host: 'http://localhost:8123',
    database: 'medcontract_analytics',
    username: 'analytics',
    password: 'analytics_password',
  });

  // Connect and subscribe
  await consumer.connect();
  await consumer.subscribe({ topic: 'contracts.opportunity.viewed', fromBeginning: false });

  console.log('✅ Consumer connected and subscribed');

  // Process messages
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log(`📨 Processing event: ${event.eventId}`);

        // Format timestamps for ClickHouse
        const formatTimestamp = (ts) => {
          const date = new Date(ts);
          return date.toISOString().replace('T', ' ').replace('Z', '');
        };

        // Insert into ClickHouse
        await clickhouse.insert({
          table: 'opportunity_views',
          values: [{
            event_id: event.eventId,
            timestamp: formatTimestamp(event.timestamp),
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
            response_deadline: event.opportunityMetadata?.responseDeadline ? formatTimestamp(event.opportunityMetadata.responseDeadline) : '1970-01-01 00:00:00.000',
            user_agent: '',
            ip_hash: '',
            processing_time_ms: Date.now() - event.timestamp,
          }],
          format: 'JSONEachRow',
        });

        console.log(`✅ Event ${event.eventId} written to ClickHouse`);
      } catch (error) {
        console.error('❌ Error processing message:', error);
      }
    },
  });

  // Keep running
  console.log('📊 Analytics Service consumer is running...');
}

runTestConsumer().catch(console.error);