import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PlasmaConcentration } from "@/components/charts/lib/pharma"
const points = Array.from({ length: 25 }, (_, i) => {
  const t = i
  const ka = 1.1, ke = 0.14
  return { hours: t, concentration: 420 * (Math.exp(-ke * t) - Math.exp(-ka * t)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plasma concentration</CardTitle>
        <CardDescription>One dose, with the parameters read off the curve</CardDescription>
      </CardHeader>
      <CardContent>
        <PlasmaConcentration points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half-life is the terminal slope <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Single oral dose
        </div>
      </CardFooter>
    </Card>
  )
}
