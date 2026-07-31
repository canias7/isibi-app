import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LamenessScore } from "@/components/charts/lib/herd"
const rounds = [
  { label: "Jan", counts: [128, 42, 21, 9] },
  { label: "Mar", counts: [131, 44, 18, 7] },
  { label: "May", counts: [140, 38, 16, 6] },
  { label: "Jul", counts: [146, 34, 14, 6] },
  { label: "Sep", counts: [138, 41, 15, 6] },
  { label: "Nov", counts: [144, 36, 14, 6] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mobility scoring</CardTitle>
        <CardDescription>The distribution, not the headline rate</CardDescription>
      </CardHeader>
      <CardContent>
        <LamenessScore rounds={rounds} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Score 2 never resolves on its own <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six rounds
        </div>
      </CardFooter>
    </Card>
  )
}
