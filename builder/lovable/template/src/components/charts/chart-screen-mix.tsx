import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScreenMix } from "@/components/charts/lib/cinema"
const screens = [
  { name: "Screen 1", seats: 312, admissions: 4820, boxOffice: 42400 },
  { name: "Screen 2", seats: 180, admissions: 3960, boxOffice: 33200 },
  { name: "Screen 3", seats: 96, admissions: 1140, boxOffice: 9800 },
  { name: "Screen 4 · premium", seats: 62, admissions: 1180, boxOffice: 18900, premium: true },
  { name: "Screen 5", seats: 140, admissions: 2260, boxOffice: 18100 },
  { name: "Screen 6 · premium", seats: 48, admissions: 860, boxOffice: 14600, premium: true },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Screen efficiency</CardTitle>
        <CardDescription>Box office per seat-hour</CardDescription>
      </CardHeader>
      <CardContent>
        <ScreenMix screens={screens} openHours={98} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The biggest screen is not the best use of the building <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One week
        </div>
      </CardFooter>
    </Card>
  )
}
