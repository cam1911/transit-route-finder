BEGIN;

SELECT plan(36);

SELECT ok(relrowsecurity, format('%s has RLS enabled', relname))
FROM pg_class
WHERE oid IN (
  'public.agencies'::regclass,
  'public.routes'::regclass,
  'public.stops'::regclass,
  'public.shape_catalog'::regclass,
  'public.shapes'::regclass,
  'public.trips'::regclass,
  'public.stop_times'::regclass,
  'public.route_shapes'::regclass,
  'public.route_shape_variants'::regclass
)
ORDER BY relname;

SELECT ok(
  NOT (
    has_table_privilege('anon', schemaname || '.' || tablename, 'SELECT')
    OR has_table_privilege('anon', schemaname || '.' || tablename, 'INSERT')
    OR has_table_privilege('anon', schemaname || '.' || tablename, 'UPDATE')
    OR has_table_privilege('anon', schemaname || '.' || tablename, 'DELETE')
  ),
  format('anon has no privileges on %s', tablename)
)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'agencies',
    'routes',
    'stops',
    'shape_catalog',
    'shapes',
    'trips',
    'stop_times',
    'route_shapes',
    'route_shape_variants'
  )
ORDER BY tablename;

SELECT ok(
  NOT (
    has_table_privilege('authenticated', schemaname || '.' || tablename, 'SELECT')
    OR has_table_privilege('authenticated', schemaname || '.' || tablename, 'INSERT')
    OR has_table_privilege('authenticated', schemaname || '.' || tablename, 'UPDATE')
    OR has_table_privilege('authenticated', schemaname || '.' || tablename, 'DELETE')
  ),
  format('authenticated has no privileges on %s', tablename)
)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'agencies',
    'routes',
    'stops',
    'shape_catalog',
    'shapes',
    'trips',
    'stop_times',
    'route_shapes',
    'route_shape_variants'
  )
ORDER BY tablename;

SELECT is(
  COUNT(pg_policies.policyname)::bigint,
  0::bigint,
  format('%s has no browser-access policy', table_name)
)
FROM (
  VALUES
    ('agencies'),
    ('routes'),
    ('stops'),
    ('shape_catalog'),
    ('shapes'),
    ('trips'),
    ('stop_times'),
    ('route_shapes'),
    ('route_shape_variants')
) AS expected(table_name)
LEFT JOIN pg_policies
  ON pg_policies.schemaname = 'public'
  AND pg_policies.tablename = expected.table_name
GROUP BY table_name
ORDER BY table_name;

SELECT * FROM finish();
ROLLBACK;
