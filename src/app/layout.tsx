
import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import Head from 'next/head'; // Import Head

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Metadata object (preferred way for static metadata in App Router)
export const metadata: Metadata = {
  title: 'Reddit memes scrapper', // Updated title
  description: 'Scrape trendy images from subreddits. Find the latest memes, pictures, and viral content.',
  keywords: [
      'memes',
      'funny memes',
      'trump memes',
      'funny cat memes',
      'knee surgery memes',
      'funny memes 2024',
      'ohio memes',
      'dog memes',
      'chill guy memes',
      'memes finder',
      'memes scrapper',
      'reddit memes'
    ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning should ideally be on the element where the mismatch occurs.
    // Browser extensions often add attributes to the body.
    <html lang="en">
       {/*
         Using next/head here for the referrer policy.
         Alternatively, configure this in next.config.js headers for a global setting.
         <Head> must be inside the direct child of the `html` tag if used.
         However, putting Head directly in layout for App Router can cause issues.
         It's generally better to place <Head> or manage metadata within page components
         or use the `metadata` export as shown above for static values.
         If dynamic <Head> manipulation is truly needed in layout, structure carefully.
         Let's keep it simple and rely on the metadata object or potentially configure headers.
         Forcing <Head> here to add the meta tag as requested, but be aware of potential complexities.
       */}
       <Head>
           <meta name="referrer" content="no-referrer-when-downgrade" />
       </Head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning={true}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
