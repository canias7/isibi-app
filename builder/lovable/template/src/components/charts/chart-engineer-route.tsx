import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EngineerRoute } from "@/components/charts/lib/fieldservice"
const stops = [
  { name: "Warmley, boiler service", milesFromPrevious: 6.2, onSiteMinutes: 55 },
  { name: "Keynsham, no heat", milesFromPrevious: 4.8, onSiteMinutes: 80, promisedBy: "10:30" },
  { name: "Bath, leak trace", milesFromPrevious: 11.4, onSiteMinutes: 95 },
  { name: "Bristol BS5, controls", milesFromPrevious: 14.9, onSiteMinutes: 40, promisedBy: "14:00" },
  { name: "Bath, cylinder", milesFromPrevious: 13.6, onSiteMinutes: 70 },
  { name: "Saltford, service", milesFromPrevious: 5.1, onSiteMinutes: 50 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>A day's route</CardTitle>
        <CardDescription>Travel into each stop, in the order run</CardDescription>
      </CardHeader>
      <CardContent>
        <EngineerRoute stops={stops} costPerMile={0.62} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The miles are the price of the promise <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One engineer
        </div>
      </CardFooter>
    </Card>
  )
}
