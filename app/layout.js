import './globals.css';

export const metadata = {
  title: 'Atestio — platforma pre certifikovaný profesijný rast',
  description: 'Akreditované programy pre pedagógov a odborné profesie. Online, vlastným tempom, s reálnym prínosom.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
