import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SourceYield } from "@/components/charts/lib/recruiting"
const sources = [
  { name: "Referral", applications: 210, interviews: 84, hires: 22, spend: 44000, retainedAt12m: 20 },
  { name: "Agency", applications: 96, interviews: 61, hires: 18, spend: 162000, retainedAt12m: 13 },
  { name: "Job board", applications: 4820, interviews: 142, hires: 21, spend: 38000, retainedAt12m: 14 },
  { name: "Direct sourcing", applications: 640, interviews: 118, hires: 26, spend: 96000, retainedAt12m: 22 },
  { name: "Careers site", applications: 1940, interviews: 66, hires: 12, spend: 14000, retainedAt12m: 9 },
  { name: "University", applications: 880, interviews: 74, hires: 16, spend: 52000, retainedAt12m: 15 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Source yield</CardTitle>
        <CardDescription>Cost per hire, and per hire who stayed</CardDescription>
      </CardHeader>
      <CardContent>
        <SourceYield sources={sources} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The cheapest channel changes once retention is counted <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
