import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StylistColumn } from "@/components/charts/lib/salon"
const appointments = [
  { client: "R. Okafor", service: "Cut and finish", start: 9, end: 9.75, value: 34 },
  { client: "T. Lindqvist", service: "Blow dry", start: 9.75, end: 10.25, value: 24 },
  { client: "M. Ferreira", service: "Highlights", start: 10.75, end: 14, value: 118 },
  { client: "S. Achebe", service: "Root touch-up", start: 14.25, end: 15.5, value: 54 },
  { client: "P. Dhillon", service: "Cut and finish", start: 16.5, end: 17.25, value: 34 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A column</CardTitle>
        <CardDescription>Takings hide the space between</CardDescription>
      </CardHeader>
      <CardContent>
        <StylistColumn appointments={appointments} dayStart={9} dayEnd={18} ratePerHour={46} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Forty minutes nobody could have booked <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Thursday
        </div>
      </CardFooter>
    </Card>
  )
}
