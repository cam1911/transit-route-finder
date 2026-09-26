import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";

const REQUIRED_FILES = ["routes.txt", "stops.txt", "trips.txt", "stop_times.txt", "shapes.txt"];

function readCsv(zip, filename, required = false) {
  const entry = zip.getEntries().find((candidate) => candidate.entryName.split("/").at(-1) === filename);
  if (!entry) {
    if (required) throw new Error(`GTFS file missing: ${filename}`);
    return [];
  }
  return parse(entry.getData().toString("utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
}

export function parseGtfs(buffer) {
  const zip = new AdmZip(buffer);
  const tables = { agency: readCsv(zip, "agency.txt") };
  for (const filename of REQUIRED_FILES) {
    tables[filename.replace(".txt", "")] = readCsv(zip, filename, true);
  }
  return tables;
}