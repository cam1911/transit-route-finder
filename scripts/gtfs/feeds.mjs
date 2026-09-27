// Feed-specific metadata is configuration, separate from reusable import logic.
// Add another provider here to reuse the parser, validator, and database importer.
export const feeds = {
  dart: {
    id: "dart",
    name: "Dallas Area Rapid Transit",
    feedUrl: "https://www.dart.org/transitdata/latest/google_transit.zip",
    timezone: "America/Chicago",
    lang: "en",
  },
};