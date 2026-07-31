import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PayBand } from "@/components/charts/lib/hr"
const bands = [
  { grade: "Grade 2", min: 28000, mid: 33000, max: 38000, people: [29000, 31500, 33000, 34500, 37000, 39500] },
  { grade: "Grade 3", min: 36000, mid: 43000, max: 50000, people: [37000, 41000, 43500, 46000, 49000] },
  { grade: "Grade 4", min: 48000, mid: 58000, max: 68000, people: [46500, 52000, 58000, 61000, 66000, 70500] },
  { grade: "Grade 5", min: 64000, mid: 78000, max: 92000, people: [69000, 76000, 84000, 91000] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bands and the people in them</CardTitle>
        <CardDescription>Who sits outside</CardDescription>
      </CardHeader>
      <CardContent>
        <PayBand bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Above the maximum has nowhere to go <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four grades
        </div>
      </CardFooter>
    </Card>
  )
}
