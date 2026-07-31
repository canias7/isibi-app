import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GradeTonnage } from "@/components/charts/lib/mining"
let s = 91
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const blocks = Array.from({ length: 900 }, () => ({
  tonnes: 22000 + Math.round(rnd() * 6000),
  grade: Math.round(Math.pow(rnd(), 2.2) * 640) / 100,
}))
const cutoffs = [0.2, 0.3, 0.4, 0.5, 0.7, 0.9, 1.2, 1.6]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade-tonnage</CardTitle>
        <CardDescription>Both axes derived from the block grades</CardDescription>
      </CardHeader>
      <CardContent>
        <GradeTonnage blocks={blocks} cutoffs={cutoffs} unit="g/t" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Tonnage and grade never peak together <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Measured and indicated
        </div>
      </CardFooter>
    </Card>
  )
}
