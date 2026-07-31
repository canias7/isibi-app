import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CatchmentProfile } from "@/components/charts/lib/water"
const points = Array.from({ length: 60 }, (_, i) => {
  const km = (i / 59) * 148
  return { km: Number(km.toFixed(1)), metres: Math.round(720 * Math.exp(-km / 42) + 12) }
})
const tributaries = [
  { km: 26, name: "Fell Beck" }, { km: 61, name: "Kiln Brook" }, { km: 104, name: "Mire Dike" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Source to mouth</CardTitle>
        <CardDescription>The river's long profile</CardDescription>
      </CardHeader>
      <CardContent>
        <CatchmentProfile points={points} tributaries={tributaries} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every long profile has an exaggeration <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          148 km
        </div>
      </CardFooter>
    </Card>
  )
}
