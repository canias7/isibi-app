import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EnzymeKinetics } from "@/components/charts/lib/chemlab"
const VMAX = 12.4, KM = 3.1
let s = 61
const j = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5) * 0.5
const points = [0.5, 1, 1.6, 2.4, 3.2, 4.4, 6, 8, 11, 15].map((substrate) => ({
  substrate,
  rate: Number(((VMAX * substrate) / (KM + substrate) + j()).toFixed(2)),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate against substrate</CardTitle>
        <CardDescription>Vmax and Km fitted</CardDescription>
      </CardHeader>
      <CardContent>
        <EnzymeKinetics points={points} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The curve never reaches Vmax <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Michaelis–Menten
        </div>
      </CardFooter>
    </Card>
  )
}
