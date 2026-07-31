import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KpiRow, DashboardGrid, AnnotatedChart, SparklineMatrix, ProgressRingGrid, MetricDistribution, WordTree, KwicList, HeadcountPyramid, MilestoneBurnup } from "./lib/composite"

const lines = [
  { before: "the barber was really", after: "and got me in early", source: "Google" },
  { before: "very", after: "and quick, no fuss at all", source: "Google" },
  { before: "always", after: "even when they are rammed", source: "Trustpilot" },
  { before: "staff are", after: "but the wait was long", source: "Google" },
  { before: "so", after: "with my son, he loved it", source: "Facebook" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyword in Context</CardTitle>
        <CardDescription>Every use of the term, centred.</CardDescription>
      </CardHeader>
      <CardContent>
        <KwicList term="friendly" lines={lines} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Almost always paired with speed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
