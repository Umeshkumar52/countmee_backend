import { createClient } from 'redis';

let redisClient;

export const initRedis = async () => {
    try {
        redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 3) return new Error('Redis connection failed after 3 retries.');
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            console.error('[Redis] Connection Error:', err.message);
        });
        
        redisClient.on('connect', () => {
            console.log('[Redis] Connected successfully to RAM datastore.');
        });

        await redisClient.connect();
        return redisClient;
    } catch (err) {
        console.error('[Redis] Failed to initialize:', err.message);
        return null;
    }
};

export const getRedisClient = () => {
    return redisClient;
};

/**
 * Cache a DP's exact location in Redis RAM. 
 * This takes < 1 millisecond and prevents MongoDB from crashing under load.
 */
export const cacheDpLocation = async (userId, orderId, lat, lng) => {
    if (!redisClient || !redisClient.isReady) return;
    
    const data = JSON.stringify({
        lat,
        lng,
        orderId,
        timestamp: Date.now()
    });
    
    // Store inside a highly optimized Hash map: Key = "dp_locations", Field = DP's userId, Value = data
    await redisClient.hSet('dp_locations', userId.toString(), data);
};

/**
 * Retrieve all cached DP locations at once for the background MongoDB flush job.
 */
export const getAllCachedDpLocations = async () => {
    if (!redisClient || !redisClient.isReady) return {};
    
    const data = await redisClient.hGetAll('dp_locations');
    // data format: { "userIdStr1": "{lat, lng...}", "userIdStr2": "{lat, lng...}" }
    return data;
};
