import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StringGrowth } from "@/components/charts/lib/translation"
let s = 88
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const make = (base: number, shortBoost: number) =>
  Array.from({ length: 60 }, () => {
    const source = 4 + Math.round(Math.pow(rnd(), 2) * 76)
    const f = base + (source <= 20 ? shortBoost : 0) + (rnd() - 0.5) * 0.22
    return { source, translated: Math.max(1, Math.round(source * f)) }
  })
const locales = [
  { name: "German", pairs: make(1.32, 0.26) },
  { name: "French", pairs: make(1.19, 0.18) },
  { name: "Spanish", pairs: make(1.21, 0.15) },
  { name: "Finnish", pairs: make(1.28, 0.22) },
  { name: "Japanese", pairs: make(0.62, 0.09) },
  { name: "Korean", pairs: make(0.71, 0.12) },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Text expansion</CardTitle>
        <CardDescription>The worst string, not the average</CardDescription>
      </CardHeader>
      <CardContent>
        <StringGrowth locales={locales} budgetFactor={1.4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An average cannot overflow a button <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Against a ×1.4 budget
        </div>
      </CardFooter>
    </Card>
  )
}
