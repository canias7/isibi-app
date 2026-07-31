import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FilmHire } from "@/components/charts/lib/cinema"
const weeks = [
  { week: 1, gross: 42000 },
  { week: 2, gross: 18900 },
  { week: 3, gross: 9450 },
  { week: 4, gross: 5100 },
  { week: 5, gross: 2900 },
  { week: 6, gross: 1740 },
]
const scale = [0.62, 0.55, 0.45, 0.35, 0.3, 0.25]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Film hire</CardTitle>
        <CardDescription>The scale against what it actually costs</CardDescription>
      </CardHeader>
      <CardContent>
        <FilmHire weeks={weeks} scale={scale} houseNut={1800} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A terms sheet quotes the scale and the cinema pays the weighted number <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One run
        </div>
      </CardFooter>
    </Card>
  )
}
