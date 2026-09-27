// The root layout wraps every route in the App Router. Global CSS belongs here
// so Next.js includes it once for the entire application.
import "./globals.css";

// Next.js turns this object into the document's <title> and meta description.
export const metadata = {
  title: "Transit Home Finder",
  description: "Explore transit routes around a potential home.",
};

export default function RootLayout({ children }) {
  // `children` is whichever page (or nested layout) Next.js is rendering.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
