import "./globals.css";

export const metadata = {
  title: "Transit Home Finder",
  description: "Explore transit routes around a potential home.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
