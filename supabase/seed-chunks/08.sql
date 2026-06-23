insert into public.payments (id, order_id, restaurant_id, amount, method, status, note, created_at, updated_at, deleted_at) values
  ('payment-a2frpxwp', 'order-ttbmzk08', 'food-1-restaurant', 20, 'cash', 'completed', 'Paiement cash', '2026-06-22T11:12:16.510Z', '2026-06-22T12:45:51.854Z', null),
  ('payment-m864d32t', 'order-ttbmzk08', 'food-1-restaurant', 20, 'card', 'completed', 'Paiement card', '2026-06-22T11:12:52.098Z', '2026-06-22T12:45:51.854Z', null),
  ('payment-dj2ib1fb', 'order-dgmt51zf', 'food-1-restaurant', 3, 'cash', 'completed', 'Paiement cash', '2026-06-22T11:29:23.549Z', '2026-06-22T12:45:51.854Z', null),
  ('payment-5r9p6keb', 'order-dgmt51zf', 'food-1-restaurant', 3, 'card', 'completed', 'Paiement card', '2026-06-22T11:30:04.337Z', '2026-06-22T12:45:51.854Z', null),
  ('payment-wj1hdgt6', 'order-dgmt51zf', 'food-1-restaurant', 3.9, 'external', 'completed', 'Paiement external', '2026-06-22T11:30:57.839Z', '2026-06-22T12:45:51.854Z', null);
