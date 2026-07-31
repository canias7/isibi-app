import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DegreeDays } from "@/components/charts/lib/weather2"
const days = [
  { label: "Jan", meanC: 4.2 }, { label: "Feb", meanC: 4.6 },
  { label: "Mar", meanC: 6.8 }, { label: "Apr", meanC: 9.4 },
  { label: "May", meanC: 12.7 }, { label: "Jun", meanC: 15.8 },
  { label: "Jul", meanC: 18.1 }, { label: "Aug", meanC: 17.9 },
  { label: "Sep", meanC: 15.2 }, { label: "Oct", meanC: 11.6 },
  { label: "Nov", meanC: 7.7 }, { label: "Dec", meanC: 5.1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Heating and cooling demand</CardTitle>
        <CardDescription>Degree days about a base temperature</CardDescription>
      </CardHeader>
      <CardContent>
        <DegreeDays days={days} base={15.5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Both totals come from the same bars <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Monthly means
        </div>
      </CardFooter>
    </Card>
  )
}
