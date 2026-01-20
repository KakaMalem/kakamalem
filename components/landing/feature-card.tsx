"use client";

import { motion } from "framer-motion";
import {
  Rocket,
  Palette,
  Package,
  ClipboardList,
  Globe,
  BarChart3,
} from "lucide-react";

const iconMap = {
  rocket: Rocket,
  palette: Palette,
  package: Package,
  clipboard: ClipboardList,
  globe: Globe,
  chart: BarChart3,
} as const;

type IconName = keyof typeof iconMap;

interface FeatureCardProps {
  icon: IconName;
  title: string;
  description: string;
  index: number;
}

export function FeatureCard({
  icon,
  title,
  description,
  index,
}: FeatureCardProps) {
  const Icon = iconMap[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group rounded-xl border bg-background p-6 shadow-sm transition-shadow hover:shadow-lg"
    >
      <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
        <Icon className="size-6 text-primary" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </motion.div>
  );
}
