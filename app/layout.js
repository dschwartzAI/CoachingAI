import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import URLCleaner from "@/components/URLCleaner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Sovereign AI",
  description: "The AI platform for your coaching business",
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
