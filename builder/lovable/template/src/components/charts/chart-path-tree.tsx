import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NetworkWaterfall, ScrollDepth, ClickGrid, PathTree, AdoptionCurve, AbTestResult, EngagementMatrix, StepFunnel } from "./lib/product"

const root = {
  label: "Home", value: 1200,
  children: [
    { label: "Prices", value: 780, children: [
      { label: "Book", value: 260 },
      { label: "Left", value: 420 },
    ] },
    { label: "About", value: 210, children: [{ label: "Prices", value: 96 }] },
    { label: "Left", value: 210 },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Path Tree</CardTitle>
        <CardDescription>Where people went next.</CardDescription>
      </CardHeader>
      <CardContent>
        <PathTree root={root} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two thirds reach prices, a third of those book <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
