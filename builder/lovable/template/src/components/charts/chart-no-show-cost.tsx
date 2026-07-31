import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NoShowCost } from "@/components/charts/lib/salon"
const buckets = [
  { label: "Over 48 hours' notice", count: 31, meanMinutes: 55, refilledShare: 0.84 },
  { label: "24 to 48 hours", count: 22, meanMinutes: 60, refilledShare: 0.61 },
  { label: "Same day", count: 27, meanMinutes: 70, refilledShare: 0.22 },
  { label: "Did not arrive", count: 19, meanMinutes: 75, refilledShare: 0.05 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No-shows</CardTitle>
        <CardDescription>Split by notice, not by reason</CardDescription>
      </CardHeader>
      <CardContent>
        <NoShowCost buckets={buckets} chairRatePerHour={46} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Notice is the only part you can act on <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}
