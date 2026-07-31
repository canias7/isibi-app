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

const branches = [
  { text: "staff are really friendly", value: 84, children: [{ text: "and quick", value: 31 }, { text: "and helpful", value: 22 }] },
  { text: "staff are always busy", value: 26, children: [{ text: "but polite", value: 11 }] },
  { text: "staff are new", value: 14 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Word Tree</CardTitle>
        <CardDescription>What follows the phrase, by frequency.</CardDescription>
      </CardHeader>
      <CardContent>
        <WordTree root="the staff are" branches={branches} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          \u201cfriendly\u201d dominates <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
