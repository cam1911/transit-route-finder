// PostCSS transforms app/globals.css during the Next.js build. Tailwind's
// plugin scans component class names and emits the utilities they use.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
