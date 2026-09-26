import { feeds } from "./gtfs/feeds.mjs";
import { importFeed } from "./gtfs/import.mjs";

if (!process.argv.slice(2).some((argument) => argument === "--help" || argument === "-h")) {
  importFeed(feeds.dart).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
