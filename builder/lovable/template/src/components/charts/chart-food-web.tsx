import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FoodWeb } from "@/components/charts/lib/biolang"
const species = [
  { name: "Algae", level: 1 },
  { name: "Detritus", level: 1 },
  { name: "Daphnia", level: 2 },
  { name: "Mayfly", level: 2 },
  { name: "Snail", level: 2 },
  { name: "Roach", level: 3 },
  { name: "Perch", level: 3 },
  { name: "Pike", level: 4 },
  { name: "Heron", level: 4 },
]
const links = [
  { from: "Algae", to: "Daphnia" }, { from: "Algae", to: "Snail" },
  { from: "Detritus", to: "Mayfly" }, { from: "Detritus", to: "Snail" },
  { from: "Daphnia", to: "Roach" }, { from: "Mayfly", to: "Roach" },
  { from: "Mayfly", to: "Perch" }, { from: "Snail", to: "Perch" },
  { from: "Roach", to: "Pike" }, { from: "Perch", to: "Pike" },
  { from: "Roach", to: "Heron" }, { from: "Perch", to: "Heron" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Food web</CardTitle>
        <CardDescription>Height is trophic level</CardDescription>
      </CardHeader>
      <CardContent>
        <FoodWeb species={species} links={links} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A producer can never sit above a predator <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Freshwater, simplified
        </div>
      </CardFooter>
    </Card>
  )
}
