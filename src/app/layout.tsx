import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'الشعلة لخدمة السيارات — سجل التشغيل اليومي',
  description: 'AL SHULAH CARS SERVICE — نظام تشغيل يومي',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=Almarai:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
