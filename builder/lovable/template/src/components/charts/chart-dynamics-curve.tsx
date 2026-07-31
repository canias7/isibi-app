import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DynamicsCurve } from "@/components/charts/lib/music2"
let s = 12
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const shape = [42, 44, 48, 52, 55, 58, 62, 66, 70, 75, 79, 84, 88, 86, 81, 74, 68, 66, 62, 58, 52, 47]
const points = shape.map((db, i) => ({ bar: i * 2 + 1, db: +(db + (rnd() - 0.5) * 2.5).toFixed(1) }))
const marks = [
  { bar: 1, dynamic: "pp" }, { bar: 9, dynamic: "p" }, { bar: 17, dynamic: "mf" },
  { bar: 25, dynamic: "ff" }, { bar: 33, dynamic: "mp" }, { bar: 41, dynamic: "pp" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dynamics</CardTitle>
        <CardDescription>Played level against the written marking</CardDescription>
      </CardHeader>
      <CardContent>
        <DynamicsCurve points={points} marks={marks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The written pianissimo came out mezzo <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Bar by bar
        </div>
      </CardFooter>
    </Card>
  )
}
