import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StoryMap } from "@/components/charts/lib/strategy"
const activities = [
  { name: "Find", stories: [{ title: "Browse services", release: 0 }, { title: "Search by stylist", release: 1 }] },
  { name: "Choose", stories: [{ title: "Pick a slot", release: 0 }, { title: "See who is free", release: 1 }, { title: "Waitlist", release: 2 }] },
  { name: "Book", stories: [{ title: "Enter details", release: 0 }, { title: "Pay a deposit", release: 1 }] },
  { name: "Manage", stories: [{ title: "Cancel", release: 0 }, { title: "Reschedule", release: 1 }, { title: "Rebook the same", release: 2 }] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Story map</CardTitle>
        <CardDescription>Activities across, releases down</CardDescription>
      </CardHeader>
      <CardContent>
        <StoryMap activities={activities} releases={["Walking skeleton", "First real release", "Nice to have"]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A slice is a release that works end to end <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Booking flow
        </div>
      </CardFooter>
    </Card>
  )
}
