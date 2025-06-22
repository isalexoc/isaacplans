"use client";

import { Hero } from "@/components/hero";
import { Services } from "@/components/services";
import { About } from "@/components/about";
import { Coverage } from "@/components/states";
import { Contact } from "@/components/contact";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Services />
      <About />
      <Coverage />
      <Contact />
    </main>
  );
}
