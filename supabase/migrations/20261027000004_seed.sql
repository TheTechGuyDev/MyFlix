-- Starting configuration only (no fake members, payments or titles).

insert into public.plans (id, name, price, annual_discount, resolution, quality, devices, max_height, screens, downloads, badge, sort) values
  ('mobile',   'Mobile',   1500, 15, '480p',                'Fair',  'Phone, tablet',               480,  1, 1, null,           1),
  ('basic',    'Basic',    2500, 15, '720p (HD)',           'Good',  'TV, computer, phone, tablet', 720,  1, 1, null,           2),
  ('standard', 'Standard', 4000, 15, '1080p (Full HD)',     'Great', 'TV, computer, phone, tablet', 1080, 2, 2, 'Most Popular', 3),
  ('premium',  'Premium',  5500, 15, '4K (Ultra HD) + HDR', 'Best',  'TV, computer, phone, tablet', 2160, 4, 6, null,           4)
on conflict (id) do nothing;

insert into public.site_settings (id, data) values (1, '{
  "platformName": "MyFlix",
  "supportEmail": "help@myflix.ng",
  "supportPhone": "",
  "supportWhatsapp": "",
  "maintenance": false,
  "maintenanceMessage": "MyFlix is getting an upgrade. We''ll be back shortly.",
  "signupsOpen": true,
  "announcement": "",
  "defaultLanguage": "English",
  "maxProfiles": 5,
  "downloadsEnabled": true,
  "maxDownloadsPerDevice": 25,
  "downloadExpiryDays": 30,
  "dataSaverDefault": false,
  "watermarkEnabled": true,
  "drmEnabled": false,
  "screenshotBlock": true,
  "streamLimitEnforced": true,
  "geoRestrictNigeria": false,
  "transferEnabled": true,
  "ussdEnabled": true,
  "smsEnabled": false,
  "emailCodesEnabled": true,
  "staffSessionMinutes": 30
}'::jsonb)
on conflict (id) do nothing;

insert into public.curation (id, data) values (1, '{"rows": []}'::jsonb) on conflict (id) do nothing;

insert into public.roles (id, name, permissions, system) values
  ('super',   'Super Admin',     array['all'], true),
  ('content', 'Content Manager', array['overview', 'content', 'uploads', 'curation', 'calendar', 'analytics'], true),
  ('support', 'Support Agent',   array['overview', 'users', 'support'], true),
  ('finance', 'Finance',         array['overview', 'users', 'plans', 'payments', 'analytics'], true),
  ('growth',  'Marketing',       array['overview', 'campaigns', 'analytics', 'curation'], true)
on conflict (id) do nothing;
