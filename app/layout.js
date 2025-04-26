import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import URLCleaner from "@/components/URLCleaner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Coaching AI Platform",
  description: "AI-powered coaching platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <URLCleaner />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
