import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WeedingCandidates } from "@/components/charts/lib/libraries"
let s = 302
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const items = Array.from({ length: 70 }, (_, i) => {
  const ageYears = Math.round(Math.pow(rnd(), 0.8) * 34 * 10) / 10
  // older stock is idler on average, but not always
  const idleYears = Math.round(Math.min(ageYears, Math.pow(rnd(), 1.6) * (2 + ageYears * 0.5)) * 10) / 10
  return {
    name: `Item ${i + 1}`,
    ageYears,
    idleYears,
    copies: 1 + Math.round(Math.pow(rnd(), 2.4) * 7),
    protectedItem: rnd() < 0.07,
  }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weeding</CardTitle>
        <CardDescription>Age and use together, never one of them</CardDescription>
      </CardHeader>
      <CardContent>
        <WeedingCandidates items={items} maxAgeYears={12} maxIdleYears={5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Age alone withdraws a classic <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One sample shelf
        </div>
      </CardFooter>
    </Card>
  )
}
