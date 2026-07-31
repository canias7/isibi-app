import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShowtimeGrid } from "@/components/charts/lib/cinema"
const screens = [
  { name: "Screen 1", seats: 312, shows: [
    { title: "Blockbuster", startMinute: 660, runtimeMin: 148, admissions: 84 },
    { title: "Blockbuster", startMinute: 840, runtimeMin: 148, admissions: 196 },
    { title: "Blockbuster", startMinute: 1020, runtimeMin: 148, admissions: 284 },
    { title: "Blockbuster", startMinute: 1200, runtimeMin: 148, admissions: 141 }] },
  { name: "Screen 2", seats: 180, shows: [
    { title: "Family animation", startMinute: 630, runtimeMin: 96, admissions: 148 },
    { title: "Family animation", startMinute: 760, runtimeMin: 96, admissions: 162 },
    { title: "Thriller", startMinute: 900, runtimeMin: 124, admissions: 88 },
    { title: "Thriller", startMinute: 1060, runtimeMin: 124, admissions: 104 },
    { title: "Thriller", startMinute: 1220, runtimeMin: 124, admissions: 46 }] },
  { name: "Screen 3", seats: 96, shows: [
    { title: "Arthouse", startMinute: 720, runtimeMin: 132, admissions: 21 },
    { title: "Arthouse", startMinute: 900, runtimeMin: 132, admissions: 38 },
    { title: "Arthouse", startMinute: 1080, runtimeMin: 132, admissions: 62 }] },
  { name: "Screen 4 · premium", seats: 62, shows: [
    { title: "Blockbuster", startMinute: 780, runtimeMin: 148, admissions: 48 },
    { title: "Blockbuster", startMinute: 960, runtimeMin: 148, admissions: 58 },
    { title: "Blockbuster", startMinute: 1140, runtimeMin: 148, admissions: 61 }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Screens today</CardTitle>
        <CardDescription>Seat-hours sold, not showtimes run</CardDescription>
      </CardHeader>
      <CardContent>
        <ShowtimeGrid screens={screens} openMinute={600} closeMinute={1440} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Six shows a fifth full earns less than three that are packed <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four screens
        </div>
      </CardFooter>
    </Card>
  )
}
