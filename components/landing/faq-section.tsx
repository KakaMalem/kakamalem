"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How long is the free trial?",
    answer:
      "You get a full 7-day free trial with access to all features. No credit card required to start. This gives you enough time to set up your store, add products, and see how everything works.",
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No, you can start your free trial instantly without any payment information. We only ask for payment details when you decide to upgrade to the Pro plan after your trial ends.",
  },
  {
    question: "Can I use my own domain?",
    answer:
      "Yes, you can connect your own custom domain to your store. Your store will also have a free subdomain like yourshop.kakamalem.com that you can use right away.",
  },
  {
    question: "What payment methods can my customers use?",
    answer:
      "Your customers can pay using cash on delivery, bank transfer, or mobile money services popular in Afghanistan. We're continuously adding more payment options to serve the local market better.",
  },
  {
    question: "Is my store data secure?",
    answer:
      "Absolutely. All stores use SSL encryption for secure connections, and we perform daily backups of your data. Your customer information and business data are protected with enterprise-grade security.",
  },
  {
    question: "What happens when my trial ends?",
    answer:
      "When your 7-day trial ends, you can upgrade to our Pro plan for 1,100 AFN/month to continue selling. If you don't upgrade, your store will become inactive but your data will be preserved for 30 days.",
  },
];

export function FaqSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl"
    >
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left text-base font-medium">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </motion.div>
  );
}
