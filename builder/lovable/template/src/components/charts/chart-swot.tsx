import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SwotGrid, OkrTree, MetroMap, SeatingChart, ResourceHistogram } from "./lib/org2"

const strengths = ["Loyal regulars", "Prime corner site", "Five-star rating"]
const weaknesses = ["One colourist", "No late nights", "Cash-only till"]
const opportunities = ["Office block opening", "Wedding packages", "Gift cards"]
const threats = ["Chain opening nearby", "Rent review", "Rising stock costs"]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>SWOT</CardTitle>
        <CardDescription>The classic 2×2, filled in.</CardDescription>
      </CardHeader>
      <CardContent>
        <SwotGrid strengths={strengths} weaknesses={weaknesses} opportunities={opportunities} threats={threats} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The weaknesses are all fixable <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
