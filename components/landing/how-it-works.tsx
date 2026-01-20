"use client";

import { motion } from "framer-motion";
import { UserPlus, ImagePlus, Banknote } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    number: "1",
    title: "Sign up in seconds",
    description:
      "Create your account with just an email. No credit card or complicated setup required.",
  },
  {
    icon: ImagePlus,
    number: "2",
    title: "Add your products",
    description:
      "Upload product photos, set prices, and organize into categories. It's as easy as posting on social media.",
  },
  {
    icon: Banknote,
    number: "3",
    title: "Start selling",
    description:
      "Share your store link and start accepting orders immediately. Track sales from your dashboard.",
  },
];

export function HowItWorks() {
  return (
    <div className="relative">
      {/* Connection line - hidden on mobile */}
      <div className="absolute left-0 right-0 top-12 hidden h-0.5 bg-linear-to-r from-transparent via-border to-transparent md:block" />

      <div className="grid gap-8 md:grid-cols-3 md:gap-12">
        {steps.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            className="relative text-center"
          >
            {/* Step number with icon */}
            <div className="relative mx-auto mb-4 flex size-24 items-center justify-center">
              {/* Background circle */}
              <div className="absolute inset-0 rounded-full bg-primary/10" />

              {/* Number badge */}
              <div className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-md">
                {step.number}
              </div>

              {/* Icon */}
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <step.icon className="size-10 text-primary" />
              </motion.div>
            </div>

            <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
