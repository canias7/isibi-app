import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CohortSurvival } from "@/components/charts/lib/actuarial"
let s = 5
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const mk = (name: string, hazard: number, n: number) => ({
  name,
  observations: Array.from({ length: n }, () => {
    const t = Math.round(-Math.log(1 - rnd()) / hazard)
    const censorAt = Math.round(rnd() * 60 + 20)
    return t <= censorAt ? { time: Math.min(t, 60), event: t <= 60 } : { time: Math.min(censorAt, 60), event: false }
  }),
})
const groups = [mk("Treatment", 0.022, 60), mk("Control", 0.045, 60)]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Survival</CardTitle>
        <CardDescription>Kaplan–Meier with the censoring visible</CardDescription>
      </CardHeader>
      <CardContent>
        <CohortSurvival groups={groups} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Dropping the censored would overstate the hazard <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Two groups
        </div>
      </CardFooter>
    </Card>
  )
}
