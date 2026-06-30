import { Cashfree, CFEnvironment } from "cashfree-pg";

Cashfree.XClientId = process.env.CASHFREE_APP_ID;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;

Cashfree.XEnvironment = CFEnvironment.SANDBOX;
// For production:
// Cashfree.XEnvironment = CFEnvironment.PRODUCTION;

export default Cashfree;
