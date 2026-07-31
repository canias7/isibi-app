import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChairUtilisation } from "@/components/charts/lib/dentistry"
const sessions = [
  { name: "Mon am · Dr Aziz", minutes: 210, treating: 148, turnaround: 32, admin: 14, fta: 0 },
  { name: "Mon pm · Dr Aziz", minutes: 210, treating: 121, turnaround: 28, admin: 11, fta: 40 },
  { name: "Tue am · Dr Nowak", minutes: 210, treating: 164, turnaround: 26, admin: 12, fta: 0 },
  { name: "Tue pm · hygienist", minutes: 210, treating: 156, turnaround: 34, admin: 8, fta: 20 },
  { name: "Wed am · Dr Aziz", minutes: 210, treating: 102, turnaround: 24, admin: 16, fta: 60 },
  { name: "Thu am · Dr Nowak", minutes: 210, treating: 171, turnaround: 22, admin: 9, fta: 0 },
  { name: "Fri am · hygienist", minutes: 180, treating: 128, turnaround: 26, admin: 6, fta: 20 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chair time</CardTitle>
        <CardDescription>The practice's only real capacity</CardDescription>
      </CardHeader>
      <CardContent>
        <ChairUtilisation sessions={sessions} hourlyCost={210} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A no-show cannot be sold afterwards <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One week of sessions
        </div>
      </CardFooter>
    </Card>
  )
}
