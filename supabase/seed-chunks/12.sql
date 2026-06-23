insert into public.audit (id, restaurant_slug, restaurant_id, actor_role, actor_name, action, target_type, target_id, details, created_at) values
  ('audit-0rs678qx', 'food-1', 'food-1-restaurant', 'manager', 'System', 'order_ready_notification', 'order', 'order-dgmt51zf', 'provider=android; sent=no', '2026-06-22T11:27:51.985Z'),
  ('audit-c379rc2m', 'food-1', 'food-1-restaurant', 'staff', 'Food Staff', 'order_status_changed', 'order', 'order-dgmt51zf', 'status=ready', '2026-06-22T11:27:53.208Z'),
  ('audit-585jbkuq', 'food-1', 'food-1-restaurant', 'manager', 'System', 'order_served_notification', 'order', 'order-dgmt51zf', 'provider=android; sent=no', '2026-06-22T11:28:31.051Z'),
  ('audit-kk3qlw4c', 'food-1', 'food-1-restaurant', 'staff', 'Food Staff', 'order_status_changed', 'order', 'order-dgmt51zf', 'status=served', '2026-06-22T11:28:33.970Z'),
  ('audit-zovazliw', 'food-1', 'food-1-restaurant', 'manager', 'System', 'order_served_notification', 'order', 'order-dgmt51zf', 'provider=android; sent=no', '2026-06-22T11:28:58.220Z'),
  ('audit-60y66ali', 'food-1', 'food-1-restaurant', 'staff', 'Food Staff', 'order_status_changed', 'order', 'order-dgmt51zf', 'status=served', '2026-06-22T11:28:59.706Z'),
  ('audit-9ps0hr4g', 'food-1', 'food-1-restaurant', 'staff', 'Food Staff', 'order_paid', 'order', 'order-dgmt51zf', 'Table 6 · 3 EUR cash · reste 6.9 EUR', '2026-06-22T11:29:27.298Z'),
  ('audit-wwbggdfr', 'food-1', 'food-1-restaurant', 'staff', 'Food Staff', 'order_paid', 'order', 'order-dgmt51zf', 'Table 6 · 3 EUR carte · reste 3.9000000000000004 EUR', '2026-06-22T11:30:08.815Z'),
  ('audit-5w4wikze', 'food-1', 'food-1-restaurant', 'staff', 'Food Staff', 'order_paid', 'order', 'order-dgmt51zf', 'Table 6 · 3.9 EUR externe · réglé', '2026-06-22T11:31:01.191Z'),
  ('audit-g474zijg', 'food-1', 'food-1-restaurant', 'staff', 'Food Staff', 'order_opened', 'order', 'order-zijqxx62', 'table · table=Table 11', '2026-06-22T12:44:22.050Z');
commit;
