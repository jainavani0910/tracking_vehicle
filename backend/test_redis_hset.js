const redis = require("redis");
const client = redis.createClient({ url: 'redis://localhost:6379' });
async function test() {
  await client.connect();
  const pipeline = client.multi();
  pipeline.hSet("test_hash", ["field1", "val1", "field2", "val2"]);
  const res = await pipeline.exec();
  console.log(res);
  process.exit(0);
}
test();
