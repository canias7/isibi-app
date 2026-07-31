import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConcessionSpend } from "@/components/charts/lib/cinema"
const showings = [
  { name: "Family animation", slot: "Sat 10:30", admissions: 162, boxOffice: 1134, concessions: 1490 },
  { name: "Blockbuster", slot: "Fri 20:00", admissions: 284, boxOffice: 3124, concessions: 1420 },
  { name: "Arthouse", slot: "Tue 18:00", admissions: 38, boxOffice: 380, concessions: 84 },
  { name: "Thriller", slot: "Sat 22:30", admissions: 104, boxOffice: 1248, concessions: 312 },
  { name: "Senior matinee", slot: "Wed 13:00", admissions: 96, boxOffice: 480, concessions: 190 },
  { name: "Blockbuster", slot: "Sun 15:00", admissions: 196, boxOffice: 1960, concessions: 1370 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribution a head</CardTitle>
        <CardDescription>Ticket and kiosk, stacked</CardDescription>
      </CardHeader>
      <CardContent>
        <ConcessionSpend showings={showings} ticketMargin={0.52} concessionMargin={0.71} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The queue matters as much as the screen <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          By showing
        </div>
      </CardFooter>
    </Card>
  )
}
