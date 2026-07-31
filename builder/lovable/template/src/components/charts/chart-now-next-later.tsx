import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NowNextLater } from "@/components/charts/lib/strategy"
const now = ["Booking conflicts", "Owner email alerts"]
const next = ["Payments", "Multi-location", "Staff rotas"]
const later = ["Loyalty scheme", "Native app", "Franchise reporting", "Marketplace"]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roadmap without dates</CardTitle>
        <CardDescription>Three horizons, no commitments implied</CardDescription>
      </CardHeader>
      <CardContent>
        <NowNextLater now={now} next={next} later={later} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Confidence falls left to right <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Reviewed monthly
        </div>
      </CardFooter>
    </Card>
  )
}
