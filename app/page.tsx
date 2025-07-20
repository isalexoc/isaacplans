import Hero from "@/components/hero";
import { Services } from "@/components/services";
import { About } from "@/components/about";
import { Coverage } from "@/components/states";
import Contact from "@/app/contact/page";

export default function HomePage() {
  return (
    <main className="w-full flex flex-col overflow-x-hidden">
      <Hero />
      <Services />
      <About />
      <Coverage />
      <Contact />
    </main>
  );
}
