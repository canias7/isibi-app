import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ParliamentSeats } from "@/components/charts/lib/civic"
const parties = [
  { name: "Green League", seats: 41 },
  { name: "Social Democrats", seats: 118 },
  { name: "Centre Alliance", seats: 63 },
  { name: "Liberal Union", seats: 97 },
  { name: "Conservative Party", seats: 131 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The chamber</CardTitle>
        <CardDescription>Seats as they sit</CardDescription>
      </CardHeader>
      <CardContent>
        <ParliamentSeats parties={parties} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The majority line comes from the total <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          After the election
        </div>
      </CardFooter>
    </Card>
  )
}
