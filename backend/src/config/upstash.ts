import { Redis } from '@upstash/redis'
import { Ratelimit } from "@upstash/ratelimit"

import "dotenv/config"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),

  // Num of request per duration 
  limiter: Ratelimit.slidingWindow(100, "60 s"),
})


export default ratelimit