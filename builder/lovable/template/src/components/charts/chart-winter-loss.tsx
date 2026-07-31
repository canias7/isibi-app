import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WinterLoss } from "@/components/charts/lib/apiary"
const years = [
  { year: "2020-21", wentIn: 28, lostStarvation: 3, lostQueen: 2, lostVarroa: 4, lostOther: 1 },
  { year: "2021-22", wentIn: 34, lostStarvation: 5, lostQueen: 2, lostVarroa: 3, lostOther: 2 },
  { year: "2022-23", wentIn: 41, lostStarvation: 8, lostQueen: 3, lostVarroa: 2, lostOther: 1 },
  { year: "2023-24", wentIn: 46, lostStarvation: 6, lostQueen: 4, lostVarroa: 3, lostOther: 2 },
  { year: "2024-25", wentIn: 52, lostStarvation: 4, lostQueen: 3, lostVarroa: 2, lostOther: 2 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overwinter loss</CardTitle>
        <CardDescription>By cause, against the national survey</CardDescription>
      </CardHeader>
      <CardContent>
        <WinterLoss years={years} surveyRate={0.17} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Starvation is the one an apiary can act on <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Five winters
        </div>
      </CardFooter>
    </Card>
  )
}
