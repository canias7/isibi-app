import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AndrewsCurves, Radviz, ParallelSets, ClusterScatter, Caterpillar, Cusum } from "./lib/multivariate"

const axes = [
  { label: "Channel", categories: ["Online", "Phone", "Walk-in"] },
  { label: "Service", categories: ["Cut", "Colour", "Beard"] },
  { label: "Outcome", categories: ["Kept", "Missed"] },
]
const rows = [
  { path: [0, 0, 0], value: 320 }, { path: [0, 1, 0], value: 110 },
  { path: [0, 2, 0], value: 90 }, { path: [0, 0, 1], value: 40 },
  { path: [1, 0, 0], value: 120 }, { path: [1, 2, 0], value: 60 },
  { path: [1, 0, 1], value: 35 }, { path: [2, 0, 0], value: 80 },
  { path: [2, 2, 0], value: 40 }, { path: [2, 0, 1], value: 45 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parallel Sets</CardTitle>
        <CardDescription>Categorical paths as ribbons.</CardDescription>
      </CardHeader>
      <CardContent>
        <ParallelSets axes={axes} rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Online bookings mostly keep their slot <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
