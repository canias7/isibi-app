import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TableTurn } from "@/components/charts/lib/restaurant"
const tables = [
  { id: "T1", seats: 2, sittings: [{ fromMin: 0, toMin: 96, covers: 2 }, { fromMin: 112, toMin: 214, covers: 2 }] },
  { id: "T2", seats: 2, sittings: [{ fromMin: 15, toMin: 88, covers: 2 }, { fromMin: 104, toMin: 190, covers: 2 }] },
  { id: "T5", seats: 4, sittings: [{ fromMin: 0, toMin: 118, covers: 4 }, { fromMin: 132, toMin: 236, covers: 3 }] },
  { id: "T8", seats: 6, sittings: [{ fromMin: 20, toMin: 165, covers: 6 }] },
  { id: "T9", seats: 6, sittings: [{ fromMin: 8, toMin: 142, covers: 5 }, { fromMin: 158, toMin: 260, covers: 6 }] },
  { id: "T11", seats: 4, sittings: [{ fromMin: 30, toMin: 121, covers: 4 }, { fromMin: 140, toMin: 248, covers: 4 }] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Table turns</CardTitle>
        <CardDescription>How long each table is held</CardDescription>
      </CardHeader>
      <CardContent>
        <TableTurn tables={tables} serviceMinutes={270} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Twos hold as long as sixes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Saturday dinner
        </div>
      </CardFooter>
    </Card>
  )
}
