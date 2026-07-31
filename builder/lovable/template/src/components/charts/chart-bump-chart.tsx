import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tornado, RangeBar, BumpChart } from "./lib/comparison"

const periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
const series = [
  { label: "Haircut", ranks: [1, 1, 1, 1, 1, 1] },
  { label: "Beard", ranks: [2, 2, 3, 3, 3, 3] },
  { label: "Towel", ranks: [3, 4, 4, 4, 4, 4] },
  { label: "Colour", ranks: [5, 5, 5, 2, 2, 2] },
  { label: "Kids", ranks: [4, 3, 2, 5, 5, 5] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bump Chart</CardTitle>
        <CardDescription>How the services ranked, month by month.</CardDescription>
      </CardHeader>
      <CardContent>
        <BumpChart series={series} periods={periods} highlight="Colour" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour climbed from fifth to second <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
