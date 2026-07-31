import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClassOccupancy } from "@/components/charts/lib/gym"
const classes = [
  { name: "Spin", slot: "Mon 18:30", capacity: 24, booked: 26, attended: 24, waitlisted: 11 },
  { name: "Yoga", slot: "Tue 19:00", capacity: 20, booked: 21, attended: 19, waitlisted: 7 },
  { name: "Body pump", slot: "Wed 18:00", capacity: 30, booked: 28, attended: 22, waitlisted: 0 },
  { name: "Spin", slot: "Thu 10:30", capacity: 24, booked: 9, attended: 7, waitlisted: 0 },
  { name: "Pilates", slot: "Fri 09:30", capacity: 18, booked: 8, attended: 6, waitlisted: 0 },
  { name: "Boxing circuit", slot: "Sat 09:00", capacity: 22, booked: 24, attended: 21, waitlisted: 5 },
  { name: "Aqua", slot: "Sun 11:00", capacity: 16, booked: 7, attended: 5, waitlisted: 0 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The timetable</CardTitle>
        <CardDescription>Waitlist drawn past capacity</CardDescription>
      </CardHeader>
      <CardContent>
        <ClassOccupancy classes={classes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A swap costs nothing and beats another instructor <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One week
        </div>
      </CardFooter>
    </Card>
  )
}
