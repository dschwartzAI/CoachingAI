import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import URLCleaner from "@/components/URLCleaner";
import { PostHogProvider } from "@/components/PostHogProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Sovereign AI",
  description: "The AI platform for your coaching business",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: "no"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={inter.className}>
        <PostHogProvider>
          <AuthProvider>
            <URLCleaner />
            {children}
            <Toaster />
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
