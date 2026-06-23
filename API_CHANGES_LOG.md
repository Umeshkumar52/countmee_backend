# API and Logic Changes Log

This document tracks recent modifications made to the backend APIs and logic for future reference.

## 1. Delivery Partner New Order Expiration (Testing Adjustment)
- **File Modified:** `src/features/deliveryPartner/dp.service.js`
- **Change:** The strict 1-minute expiration timer for direct order requests was temporarily disabled for testing. It has been increased to 1 hour to accommodate manual API testing.
- **Code:**
  ```javascript
  // COMMENTED OUT FOR TESTING: const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const oneMinuteAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour for testing
  ```

## 2. Delivery Partner Order Accept Endpoint
- **File:** `src/features/deliveryPartner/dp.route.js`
- **Change:** The `order_accept` endpoint was migrated from a GET route with path parameters to a secure POST route that accepts data in the request body.
- **Older Route:** `router.get('/order_accept/:order_id/:status/:user_id', dpController.order_accept);`
- **New Route:** `router.post('/order_accept', dpController.order_accept);`

## 3. Order Notify Delivery Partner Endpoint
- **File:** `src/features/orders/orders.route.js`
- **Change:** The `notifyDp` endpoint was migrated from a GET route with path parameters to a secure POST route that accepts data in the request body.
- **Older Route:** `router.get("/notifyDp/:orderId/:packageDetailsId", ordersController.notifyDp);`
- **New Route:** `router.post("/notifyDp", ordersController.notifyDp);`
