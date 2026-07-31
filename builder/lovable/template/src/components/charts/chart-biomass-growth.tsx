import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BiomassGrowth } from "@/components/charts/lib/aquaculture"
const weeks = Array.from({ length: 26 }, (_, i) => {
  const week = i + 1
  // one mortality event in week 14, invisible on the weight curve
  const attrition = Math.pow(0.9975, i) * (week > 14 ? 0.93 : 1)
  return {
    week,
    fish: Math.round(184000 * attrition),
    meanKg: Math.round((0.28 * Math.exp(i * 0.098)) * 1000) / 1000,
  }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Standing biomass</CardTitle>
        <CardDescription>Count times weight, moving opposite ways</CardDescription>
      </CardHeader>
      <CardContent>
        <BiomassGrowth weeks={weeks} consentT={1200} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A growth curve reads as a healthy cohort throughout <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Pen 4, one cycle
        </div>
      </CardFooter>
    </Card>
  )
}
