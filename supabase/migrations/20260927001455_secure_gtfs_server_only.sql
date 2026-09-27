-- Transit reads and feed imports go through the trusted Next.js server's direct
-- PostgreSQL connection. Browser roles therefore need no Data API privileges.
-- RLS is still enabled as defense in depth because public is an exposed Supabase
-- schema by default. No anon/authenticated policies are intentionally created.
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shape_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_shape_variants ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.agencies,
  public.routes,
  public.stops,
  public.shape_catalog,
  public.shapes,
  public.trips,
  public.stop_times,
  public.route_shapes,
  public.route_shape_variants
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE public.shapes_id_seq FROM anon, authenticated;