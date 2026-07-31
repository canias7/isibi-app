import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VaccinationDue } from "@/components/charts/lib/vet"
const months = [
  { label: "Aug", due: 148, given: 91 },
  { label: "Sep", due: 162, given: 104 },
  { label: "Oct", due: 139, given: 92 },
  { label: "Nov", due: 121, given: 84 },
  { label: "Dec", due: 96, given: 61 },
  { label: "Jan", due: 174, given: 121 },
  { label: "Feb", due: 156, given: 112 },
  { label: "Mar", due: 168, given: 127 },
  { label: "Apr", due: 181, given: 141 },
  { label: "May", due: 159, given: 126 },
  { label: "Jun", due: 147, given: 118 },
  { label: "Jul", due: 152, given: 124 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Boosters</CardTitle>
        <CardDescription>Lapsed at the month it was due</CardDescription>
      </CardHeader>
      <CardContent>
        <VaccinationDue months={months} boosterValue={62} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The visit that also finds the lump <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
