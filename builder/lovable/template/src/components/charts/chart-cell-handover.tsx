import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CellHandover } from "@/components/charts/lib/telecom"
let s = 64
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const mk = (peakAt: number, strength: number) =>
  Array.from({ length: 120 }, (_, i) => strength - Math.pow((i - peakAt) / 22, 2) * 9 + (rnd() - 0.5) * 3)
const cells = [
  { name: "Cell 1", rsrp: mk(10, -78) },
  { name: "Cell 2", rsrp: mk(52, -74) },
  { name: "Cell 3", rsrp: mk(58, -75) },
  { name: "Cell 4", rsrp: mk(104, -80) },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Handover</CardTitle>
        <CardDescription>Serving cell derived from signal plus hysteresis</CardDescription>
      </CardHeader>
      <CardContent>
        <CellHandover cells={cells} hysteresisDb={3} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Hysteresis is what stops the flapping <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Drive test
        </div>
      </CardFooter>
    </Card>
  )
}
