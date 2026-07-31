import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpirometryLoop } from "@/components/charts/lib/med2"
const loop = (peak: number, scoop: number, fvc: number) => {
  const up = Array.from({ length: 26 }, (_, i) => {
    const v = (i / 25) * fvc
    const rise = Math.min(1, v / (fvc * 0.12))
    const fall = Math.pow(1 - v / fvc, 1 + scoop)
    return { volume: v, flow: peak * rise * fall }
  })
  const down = Array.from({ length: 20 }, (_, i) => {
    const v = fvc - (i / 19) * fvc
    return { volume: v, flow: -3.1 * Math.sin((v / fvc) * Math.PI) }
  })
  return [...up, ...down]
}
const measured = loop(6.1, 1.9, 3.4)
const predicted = loop(9.4, 0.35, 4.6)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flow–volume loop</CardTitle>
        <CardDescription>Measured against predicted</CardDescription>
      </CardHeader>
      <CardContent>
        <SpirometryLoop measured={measured} predicted={predicted} fev1={2.05} fvc={3.4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The shape is the diagnosis <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Post-bronchodilator
        </div>
      </CardFooter>
    </Card>
  )
}
