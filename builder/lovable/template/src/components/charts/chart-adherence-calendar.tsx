import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdherenceCalendar } from "@/components/charts/lib/pharma"
let s = 31
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const days = Array.from({ length: 56 }, (_, i) => {
  if (i >= 30 && i <= 33) return 0
  if ((i + 3) % 7 === 0 && rnd() < 0.5) return 0
  return rnd() < 0.08 ? 0 : 1
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adherence</CardTitle>
        <CardDescription>When the doses were missed, not just how many</CardDescription>
      </CardHeader>
      <CardContent>
        <AdherenceCalendar days={days} dosesPerDay={1} weekStart={2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A four-day run beats a good percentage <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight weeks
        </div>
      </CardFooter>
    </Card>
  )
}
