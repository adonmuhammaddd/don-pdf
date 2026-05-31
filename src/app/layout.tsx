import type { Metadata } from "next";
import "./fonts.css";
import "./tokens.css";
import "./terminal.css";
import "./pdf.css";

export const metadata: Metadata = {
  title: "DonPDF — privacy-first PDF tools",
  description:
    "A local, privacy-first PDF toolkit in a retro terminal UI — merge, split, organize, rotate, and convert PDFs entirely in your browser. Your files never leave your device, no uploads, no tracking.",
};

// Applied before paint to avoid a theme flash / hydration mismatch on <html>.
const themeBootstrap = `(function(){try{
  var d=document.documentElement, s=localStorage;
  d.setAttribute('data-theme', s.getItem('dpdf:theme')||'light');
  d.setAttribute('data-accent', s.getItem('dpdf:accent')||'amber');
  d.setAttribute('data-glow', (s.getItem('dpdf:glow')||'on'));
  d.setAttribute('data-blink', (s.getItem('dpdf:blink')||'on'));
  var sl=s.getItem('dpdf:scanlines'); if(sl!=null) d.style.setProperty('--scanline-opacity',(parseInt(sl,10)/100).toFixed(3));
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" data-accent="amber" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <div id="scanlines" aria-hidden="true" />
        <div id="vignette" aria-hidden="true" />
      </body>
    </html>
  );
}
