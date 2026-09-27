import TransitExplorer from "../components/TransitExplorer";

// Files named page.js become routes in the App Router. Because this file is at
// app/page.js, this component handles GET / and delegates the UI to the feature.
export default function Home() {
  return <TransitExplorer />;
}
