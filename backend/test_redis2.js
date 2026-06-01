const redisClient = require('./redis/redisClient');
async function test() {
  await redisClient.connect().catch(()=>null);
  
  await redisClient.geoAdd('vehicles', { longitude: 77.2, latitude: 28.6, member: 'test1' });
  
  const results = await redisClient.geoSearchWith(
    'vehicles',
    { longitude: 77.2, latitude: 28.6 },
    { radius: 100, unit: 'km' },
    ['WITHCOORD']
  );
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}
test();
