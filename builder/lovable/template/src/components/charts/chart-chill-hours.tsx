import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChillHours } from "@/components/charts/lib/horticulture"
let s = 44
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const hourlyC = Array.from({ length: 2400 }, (_, h) => {
  const day = Math.floor(h / 24)
  const warmSpell = day > 58 && day < 72 ? 9 : 0
  const seasonal = 7 - Math.cos((day / 100) * Math.PI) * 4
  const diurnal = Math.sin(((h % 24) / 24) * 2 * Math.PI - 1.9) * 4.5
  return seasonal + diurnal + warmSpell + (rnd() - 0.5) * 2
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Winter chill</CardTitle>
        <CardDescription>Utah model, which subtracts for warm spells</CardDescription>
      </CardHeader>
      <CardContent>
        <ChillHours hourlyC={hourlyC} requirement={1100} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A warm January undoes December <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Cherry, 1100 CU
        </div>
      </CardFooter>
    </Card>
  )
}
