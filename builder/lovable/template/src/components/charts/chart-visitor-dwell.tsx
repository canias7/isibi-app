import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VisitorDwell } from "@/components/charts/lib/museum"
const displays = [
  { name: "Entrance orientation", passers: 17800, stoppers: 4100, medianSeconds: 22 },
  { name: "Star object case", passers: 14200, stoppers: 8900, medianSeconds: 96 },
  { name: "Interactive table", passers: 9600, stoppers: 5400, medianSeconds: 184 },
  { name: "Far gallery, textiles", passers: 3100, stoppers: 2480, medianSeconds: 141 },
  { name: "Corridor panels", passers: 16900, stoppers: 1200, medianSeconds: 18 },
  { name: "Study room", passers: 1100, stoppers: 980, medianSeconds: 420 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitor dwell</CardTitle>
        <CardDescription>Attention delivered, not capture rate</CardDescription>
      </CardHeader>
      <CardContent>
        <VisitorDwell displays={displays} totalVisitors={18400} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A capture rate rewards a case nobody passes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          18,400 visitors
        </div>
      </CardFooter>
    </Card>
  )
}
