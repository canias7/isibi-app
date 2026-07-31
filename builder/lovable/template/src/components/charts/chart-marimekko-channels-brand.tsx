import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Marimekko, SERVICE_MIX } from "./lib/marimekko"

const columns = [
  { label: "Online", total: 620, parts: [{ label: "Kept", value: 540 }, { label: "Moved", value: 52 }, { label: "Cancelled", value: 28 }] },
  { label: "Phone", total: 280, parts: [{ label: "Kept", value: 228 }, { label: "Moved", value: 34 }, { label: "Cancelled", value: 18 }] },
  { label: "Walk-in", total: 150, parts: [{ label: "Kept", value: 96 }, { label: "Moved", value: 18 }, { label: "Cancelled", value: 36 }] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marimekko</CardTitle>
        <CardDescription>Bookings by channel, in brand colour.</CardDescription>
      </CardHeader>
      <CardContent>
        <Marimekko columns={columns} showShares tones={["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Walk-ins cancel most <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
