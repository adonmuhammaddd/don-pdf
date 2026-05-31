import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./tokens.css";
import "./shell.css";
import "./components.css";
import "./controls.css";
import "./home.css";

export const metadata: Metadata = {
  title: "DonPDF — private, in-browser PDF tools",
  description:
    "Merge, split, organize, sign, watermark, convert and compress PDFs — entirely in your browser. Your files never leave your device: no uploads, no sign-up, no tracking.",
};

// Set the theme before paint to avoid a flash / hydration mismatch on <html>.
const themeBootstrap = `(function(){try{
  var t=localStorage.getItem('dpdf:theme')||'light';
  document.documentElement.setAttribute('data-theme', t);
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
