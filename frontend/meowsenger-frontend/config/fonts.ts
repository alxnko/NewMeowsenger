import { Inter as FontSans, IBM_Plex_Mono as FontMono } from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin", "cyrillic-ext"],
  variable: "--font-mono",
  weight: ["400", "700"],
});
