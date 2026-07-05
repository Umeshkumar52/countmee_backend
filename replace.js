const fs = require('fs');
const file = 'src/common/services/agenda.service.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /\s*await agenda.start\(\);/;

const newCode = \
    agenda.define('rebroadcast-unaccepted-order', async (job) => {
        const { order_id } = job.attrs.data;
        try {
            const { Order } = await import('../../features/orders/order.model.js');
            const { ORDER_STATUS } = await import('../../constants/orderStatus.js');
            const order = await Order.findById(order_id);

            // If order still not accepted
            if (order && order.status === ORDER_STATUS.CREATED) {
                console.log(\\\[Agenda] Order \\\ not accepted after 5 minutes. Rebroadcasting...\\\);
                const { PackageDetail } = await import('../../features/orders/packageDetail.model.js');
                const packageDetail = await PackageDetail.findById(order.package_id);
                
                const { broadcastOrderToNearbyDPs } = await import('../../features/orders/orders.service.js');
                
                // Pass true as the third parameter to signify it's a rebroadcast (so it doesn't loop infinitely)
                await broadcastOrderToNearbyDPs(order, packageDetail, true);
            }
        } catch (error) {
            console.error('[Agenda] Error in rebroadcast-unaccepted-order job:', error);
        }
    });

    await agenda.start();\

if (regex.test(content)) {
  content = content.replace(regex, newCode);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced successfully');
} else {
  console.log('Regex did not match');
}
