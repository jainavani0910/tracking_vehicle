const redis = require("redis");
const client = redis.createClient({ url: 'redis://localhost:6379' });
async function test() {
  await client.connect();
  const pipeline = client.multi();
  pipeline.geoAdd("test_geo", [{longitude: 10, latitude: 10, member: "a"}, {longitude: 20, latitude: 20, member: "b"}]);
  const res = await pipeline.exec();
  console.log(res);
  process.exit(0);
}
test().catch(console.error);
