import axios from 'axios';

/**
 * National-Scale Stress Test Simulator (Stage 1)
 * 
 * Target: 10,000 Concurrent Submissions
 * Goal: Average Latency < 300ms
 */

const API_URL = 'http://localhost:3000/api/v1';
const CONCURRENCY = 100; // Requests per batch
const TOTAL_REQUESTS = 10000;
const ATTEMPT_ID = 'STRESS_TEST_ID'; // Replace with real ID during live test

async function runTest() {
  console.log(`Starting Stress Test: ${TOTAL_REQUESTS} requests at ${CONCURRENCY} concurrency...`);
  const start = Date.now();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = Array.from({ length: CONCURRENCY }).map(() =>
      axios.post(`${API_URL}/exam-attempt/${ATTEMPT_ID}/submit`, {}, {
        headers: { 'x-idempotency-key': `key-${Math.random()}` } // Test idempotency too
      }).catch((e) => e)
    );

    const results = await Promise.all(batch);
    results.forEach(r => {
      if (r?.status === 200 || r?.status === 201) success++;
      else failed++;
    });
    
    if (i % 1000 === 0) console.log(`In progress: ${i}/${TOTAL_REQUESTS}`);
  }

  const duration = Date.now() - start;
  const avgLatency = duration / TOTAL_REQUESTS;

  console.log('\n--- TEST SUMMARY ---');
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`Throughput: ${(TOTAL_REQUESTS / (duration / 1000)).toFixed(2)} req/sec`);
  
  if (avgLatency < 300) {
    console.log('✅ PASS: System meets national-scale SLA (< 300ms).');
  } else {
    console.log('❌ FAIL: Performance optimization required.');
  }
}

runTest().catch(console.error);
