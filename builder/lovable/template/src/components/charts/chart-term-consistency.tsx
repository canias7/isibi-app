import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TermConsistency } from "@/components/charts/lib/translation"
const terms = [
  { source: "basket", locales: [
    { name: "de", variants: 4, approvedShare: 0.52, uses: 1840 },
    { name: "fr", variants: 3, approvedShare: 0.71, uses: 1620 },
    { name: "es", variants: 5, approvedShare: 0.41, uses: 1490 }] },
  { source: "sign in", locales: [
    { name: "de", variants: 2, approvedShare: 0.94, uses: 2210 },
    { name: "fr", variants: 3, approvedShare: 0.82, uses: 1980 },
    { name: "es", variants: 2, approvedShare: 0.96, uses: 1870 }] },
  { source: "delivery slot", locales: [
    { name: "de", variants: 6, approvedShare: 0.33, uses: 940 },
    { name: "fr", variants: 4, approvedShare: 0.48, uses: 880 },
    { name: "es", variants: 5, approvedShare: 0.39, uses: 810 }] },
  { source: "loyalty points", locales: [
    { name: "de", variants: 3, approvedShare: 0.68, uses: 620 },
    { name: "fr", variants: 2, approvedShare: 0.88, uses: 590 },
    { name: "es", variants: 3, approvedShare: 0.74, uses: 540 }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Terminology drift</CardTitle>
        <CardDescription>What the memory contains, not what the glossary says</CardDescription>
      </CardHeader>
      <CardContent>
        <TermConsistency terms={terms} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Invisible in every per-file review <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five key terms
        </div>
      </CardFooter>
    </Card>
  )
}
