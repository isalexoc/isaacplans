/* app/(site)/components/about-section.tsx */
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function AboutSection() {
  return (
    <section id="about" className="py-20">
      <div
        className="
          container mx-auto px-4
          flex flex-col lg:flex-row
          items-center justify-center
          gap-16
        "
      >
        {/* ─────────── head-shot ─────────── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex justify-center"
        >
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96">
            <Image
              src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_500/daniel_k2t4sy.png"
              alt="Isaac Orraiz, Licensed Insurance Agent"
              fill
              sizes="(max-width: 1024px) 320px, 384px"
              className="rounded-full object-cover shadow-xl"
              priority
            />
          </div>
        </motion.div>

        {/* ─────────── text block ─────────── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-xl text-center"
        >
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-custom">
            About&nbsp;Us
          </p>

          <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight text-gray-900">
            Helping&nbsp;You&nbsp;To
            <br />
            Manage&nbsp;Your&nbsp;ACA
            <br />
            Needs<span className="text-custom">!</span>
          </h2>

          {/* underline */}
          <div className="h-1 w-24 bg-custom my-5 mx-auto" />

          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            I’m <strong>Isaac Orraiz</strong>, a licensed health-insurance agent
            specialising in ACA (Obamacare) plans. I help individuals and
            families get affordable coverage tailored to their needs—including
            dental, vision, hospital indemnity, cancer and stroke plans, and
            more. You’ll get expert guidance at every step.
          </p>

          <div className="mb-8">
            <p className="font-bold text-lg text-gray-900">Isaac&nbsp;Orraiz</p>
            <p className="text-gray-700">
              Insurance Agent
              <br />
              NPN: 21592068
            </p>
          </div>

          <Button
            size="lg"
            className="bg-custom text-custom-foreground hover:bg-custom/90 mx-auto"
            onClick={() => {
              const el = document.getElementById("contact");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="mr-2">❓</span>Request&nbsp;Information
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
