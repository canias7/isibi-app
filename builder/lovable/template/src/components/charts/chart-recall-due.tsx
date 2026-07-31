import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RecallDue } from "@/components/charts/lib/optical"
const months = [
  { label: "Aug", due: 186, booked: 121, attended: 108 },
  { label: "Sep", due: 214, booked: 148, attended: 134 },
  { label: "Oct", due: 198, booked: 141, attended: 128 },
  { label: "Nov", due: 172, booked: 118, attended: 101 },
  { label: "Dec", due: 141, booked: 74, attended: 58 },
  { label: "Jan", due: 231, booked: 168, attended: 149 },
  { label: "Feb", due: 208, booked: 152, attended: 138 },
  { label: "Mar", due: 224, booked: 161, attended: 146 },
  { label: "Apr", due: 196, booked: 96, attended: 84 },
  { label: "May", due: 212, booked: 154, attended: 141 },
  { label: "Jun", due: 189, booked: 138, attended: 124 },
  { label: "Jul", due: 178, booked: 126, attended: 112 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recalls</CardTitle>
        <CardDescription>Two losses, two different answers</CardDescription>
      </CardHeader>
      <CardContent>
        <RecallDue months={months} testValue={164} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A letter that does not convert is not a reminder problem <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
