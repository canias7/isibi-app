import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InverterClipping } from "@/components/charts/lib/solar"
const hours = Array.from({ length: 16 }, (_, i) => {
  const h = i + 4
  const sun = Math.max(0, Math.sin(((h - 5) / 15) * Math.PI))
  return { label: String(h).padStart(2, "0"), dcKw: Math.round(sun * 121 * 10) / 10 }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clipping</CardTitle>
        <CardDescription>The energy lost, not the peak</CardDescription>
      </CardHeader>
      <CardContent>
        <InverterClipping hours={hours} inverterKw={100} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An alarming peak is a small fraction of the year <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One clear June day
        </div>
      </CardFooter>
    </Card>
  )
}
