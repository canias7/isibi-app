import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IvCurve } from "@/components/charts/lib/solar"
const shape = (voc: number, isc: number, k: number) =>
  Array.from({ length: 26 }, (_, i) => {
    const v = (i / 25) * voc
    return { v, i: isc * (1 - Math.pow(v / voc, k)) }
  })
const curves = [
  { name: "New module", points: shape(49.2, 11.4, 9) },
  { name: "After 8 years", points: shape(48.6, 10.9, 6) },
  { name: "Suspect string", points: shape(47.1, 10.4, 3.4) },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>IV curve</CardTitle>
        <CardDescription>The maximum power point, computed</CardDescription>
      </CardHeader>
      <CardContent>
        <IvCurve curves={curves} ratedW={410} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Voc and Isc can hold while the knee collapses <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Flash test at STC
        </div>
      </CardFooter>
    </Card>
  )
}
