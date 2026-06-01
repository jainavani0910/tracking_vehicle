const redis = require('redis');
async function test() {
  const client = redis.createClient({ url: 'redis://localhost:6379' });
  await client.connect();
  const res = await client.geoSearchWith(
    'vehicles',
    { longitude: 77.2, latitude: 28.6 },
    { width: 100, height: 100, unit: 'km' },
    ['WITHCOORD']
  );
  console.log("Found:", res.length);
  if (res.length > 0) {
    console.log("Sample:", res[0]);
  }
  await client.quit();
}
test().catch(console.error);
