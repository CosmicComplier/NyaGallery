import type { Metadata } from "next";
import { FaqContent } from "./faq-content";

export const metadata: Metadata = {
  title: "NyaGallery FAQ",
  description: "NyaGallery features, reference projects, and related links.",
};

export default function FaqPage() {
  return <FaqContent />;
}
