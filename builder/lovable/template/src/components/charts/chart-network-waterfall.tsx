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

const requests = [
  { name: "document", start: 0, wait: 120, download: 60 },
  { name: "styles.css", start: 190, wait: 70, download: 40 },
  { name: "app.js", start: 195, wait: 90, download: 240 },
  { name: "geist.woff2", start: 205, wait: 60, download: 130 },
  { name: "hero.webp", start: 320, wait: 50, download: 210 },
  { name: "/api/rows", start: 540, wait: 180, download: 30 },
  { name: "logo.svg", start: 560, wait: 30, download: 12 },
]
const marks = [{ at: 420, label: "DCL" }, { at: 760, label: "load" }]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Network Waterfall</CardTitle>
        <CardDescription>What the browser fetched, and when.</CardDescription>
      </CardHeader>
      <CardContent>
        <NetworkWaterfall requests={requests} marks={marks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The font blocks first paint <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
