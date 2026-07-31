import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GenomeTrack } from "@/components/charts/lib/biolang"
const features = [
  { start: 1200, end: 4800, label: "rpoA", strand: "+" as const },
  { start: 6100, end: 9400, label: "tufB", strand: "+" as const },
  { start: 11000, end: 12600, label: "yjeE", strand: "-" as const },
  { start: 14200, end: 19800, label: "gyrB", strand: "+" as const },
  { start: 21000, end: 23400, label: "recF", strand: "-" as const },
  { start: 25600, end: 30200, label: "dnaN", strand: "+" as const },
  { start: 31800, end: 33100, label: "yaaA", strand: "-" as const },
  { start: 35000, end: 38600, label: "ftsZ", strand: "+" as const },
  { start: 39800, end: 41600, label: "murC", strand: "-" as const },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Annotation track</CardTitle>
        <CardDescription>Features on both strands</CardDescription>
      </CardHeader>
      <CardContent>
        <GenomeTrack length={42000} features={features} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nine features over 42 kb <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Coordinates in base pairs
        </div>
      </CardFooter>
    </Card>
  )
}
