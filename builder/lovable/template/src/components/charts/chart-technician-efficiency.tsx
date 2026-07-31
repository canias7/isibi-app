import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TechnicianEfficiency } from "@/components/charts/lib/garage"
const technicians = [
  { name: "Dev", attendedHours: 160, clockedHours: 152, soldHours: 171 },
  { name: "Marek", attendedHours: 160, clockedHours: 141, soldHours: 138 },
  { name: "Aoife", attendedHours: 152, clockedHours: 149, soldHours: 132 },
  { name: "Tom", attendedHours: 160, clockedHours: 108, soldHours: 104 },
  { name: "Priya, apprentice", attendedHours: 128, clockedHours: 96, soldHours: 71 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Efficiency</CardTitle>
        <CardDescription>Two numbers, both called efficiency</CardDescription>
      </CardHeader>
      <CardContent>
        <TechnicianEfficiency technicians={technicians} labourRate={62} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Working faster does not fix an empty diary <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}
