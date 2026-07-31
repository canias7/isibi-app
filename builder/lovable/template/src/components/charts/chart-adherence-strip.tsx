import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdherenceStrip } from "@/components/charts/lib/contact"
const agents = [
  { name: "A. Okonkwo",
    scheduled: [
      { fromMinute: 540, toMinute: 660, state: "phone" as const },
      { fromMinute: 660, toMinute: 675, state: "break" as const },
      { fromMinute: 675, toMinute: 780, state: "phone" as const },
      { fromMinute: 780, toMinute: 810, state: "break" as const },
      { fromMinute: 810, toMinute: 1020, state: "phone" as const }],
    actual: [
      { fromMinute: 540, toMinute: 662, state: "phone" as const },
      { fromMinute: 662, toMinute: 677, state: "break" as const },
      { fromMinute: 677, toMinute: 780, state: "phone" as const },
      { fromMinute: 780, toMinute: 812, state: "break" as const },
      { fromMinute: 812, toMinute: 1020, state: "phone" as const }] },
  { name: "B. Ferreira",
    scheduled: [
      { fromMinute: 540, toMinute: 690, state: "phone" as const },
      { fromMinute: 690, toMinute: 705, state: "break" as const },
      { fromMinute: 705, toMinute: 780, state: "phone" as const },
      { fromMinute: 780, toMinute: 810, state: "break" as const },
      { fromMinute: 810, toMinute: 1020, state: "phone" as const }],
    actual: [
      { fromMinute: 540, toMinute: 600, state: "phone" as const },
      { fromMinute: 600, toMinute: 640, state: "away" as const },
      { fromMinute: 640, toMinute: 690, state: "phone" as const },
      { fromMinute: 690, toMinute: 710, state: "break" as const },
      { fromMinute: 710, toMinute: 780, state: "phone" as const },
      { fromMinute: 780, toMinute: 815, state: "break" as const },
      { fromMinute: 815, toMinute: 1020, state: "phone" as const }] },
  { name: "C. Lindqvist",
    scheduled: [
      { fromMinute: 540, toMinute: 660, state: "phone" as const },
      { fromMinute: 660, toMinute: 720, state: "meeting" as const },
      { fromMinute: 720, toMinute: 780, state: "phone" as const },
      { fromMinute: 780, toMinute: 810, state: "break" as const },
      { fromMinute: 810, toMinute: 1020, state: "phone" as const }],
    actual: [
      { fromMinute: 540, toMinute: 660, state: "phone" as const },
      { fromMinute: 660, toMinute: 738, state: "meeting" as const },
      { fromMinute: 738, toMinute: 780, state: "phone" as const },
      { fromMinute: 780, toMinute: 810, state: "break" as const },
      { fromMinute: 810, toMinute: 1020, state: "phone" as const }] },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adherence</CardTitle>
        <CardDescription>Minute by minute, not hours worked</CardDescription>
      </CardHeader>
      <CardContent>
        <AdherenceStrip agents={agents} shiftStartMinute={540} shiftEndMinute={1020} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The right break at the wrong time still leaves an interval short <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          09:00 to 17:00
        </div>
      </CardFooter>
    </Card>
  )
}
