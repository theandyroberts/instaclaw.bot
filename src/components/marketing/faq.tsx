import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is InstaClaw?",
    answer:
      "InstaClaw gives you a personal AI assistant that lives in Telegram. You get your own dedicated server running OpenClaw, the popular open-source AI assistant. Just open Telegram, chat with your bot, and get help with research, writing, coding, and more.",
  },
  {
    question: "Do I need any technical skills?",
    answer:
      "Not at all! The only thing you need to do is create a Telegram bot through @BotFather (we walk you through it step-by-step). Everything else -- server setup, AI configuration, updates -- is handled automatically.",
  },
  {
    question: "What's the difference between Starter and Pro?",
    answer:
      "Starter ($29/mo) uses Kimi K2.5, a powerful free AI model with unlimited usage. Pro ($49/mo) gives you a $15/mo credit to use premium models like Claude, GPT-4, or Gemini -- you pick which one you want.",
  },
  {
    question: "What is Kimi K2.5?",
    answer:
      "Kimi K2.5 is a powerful AI model by Moonshot AI. It's free to use with no rate limits, making it perfect for the Starter plan. It handles research, writing, coding, and general questions very well.",
  },
  {
    question: "Can I switch AI models?",
    answer:
      "On the Pro plan, yes! You can switch between Claude, GPT-4, Gemini, Kimi, and MiniMax anytime from your dashboard. On Starter, you use Kimi K2.5 (which is great and unlimited).",
  },
  {
    question: "Is my data private?",
    answer:
      "Yes. You get your own dedicated server -- your data is never shared with other customers. We don't read your conversations or use them for training.",
  },
  {
    question: "What happens if I cancel?",
    answer:
      "Your AI assistant stops responding, but we keep your configuration for 30 days. If you resubscribe within that window, everything picks up right where you left off.",
  },
  {
    question: "How does InstaClaw compare to SimpleClaw?",
    answer:
      "We offer the same Pro tier at $49/mo with $15 LLM credit, but we also have a Starter tier at $29/mo with unlimited Kimi AI. That's $20/mo less to get started. Same quality, better price.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="bg-gray-50 px-4 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
            Frequently Asked Questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-gray-600">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
