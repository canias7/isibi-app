import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export type QA = { question: string; answer: string };

/** Questions and answers, on the accordion. */
export function Faq({ items, className }: { items: QA[]; className?: string }) {
  return (
    <Accordion type="single" collapsible className={cn("w-full", className)}>
      {items.map((qa, i) => (
        <AccordionItem key={qa.question || i} value={"q" + i}>
          <AccordionTrigger className="text-left">{qa.question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{qa.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
