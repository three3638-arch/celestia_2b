#!/bin/bash
cd /opt/celestia
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db psql -U celestia -d celestia -c "SELECT id, product_name_snapshot, sku_desc_snapshot, item_status, unit_price_cny, quantity FROM order_items WHERE order_id = (SELECT id FROM orders WHERE order_no = 'CLS-20260620-3SJF') ORDER BY created_at;"
