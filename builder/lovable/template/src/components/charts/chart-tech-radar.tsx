import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TechRadar } from "@/components/charts/lib/strategy"
const blips = [
  { name: "TypeScript", quadrant: 0, ring: 0 },
  { name: "Rust", quadrant: 0, ring: 1, moved: "in" as const },
  { name: "CoffeeScript", quadrant: 0, ring: 3 },
  { name: "Postgres", quadrant: 1, ring: 0 },
  { name: "Neon", quadrant: 1, ring: 1, moved: "in" as const },
  { name: "MongoDB", quadrant: 1, ring: 2, moved: "out" as const },
  { name: "Playwright", quadrant: 2, ring: 0 },
  { name: "Cypress", quadrant: 2, ring: 2, moved: "out" as const },
  { name: "Vite", quadrant: 3, ring: 0 },
  { name: "Turbopack", quadrant: 3, ring: 1 },
  { name: "Webpack", quadrant: 3, ring: 3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Technology radar</CardTitle>
        <CardDescription>Four quadrants, four rings</CardDescription>
      </CardHeader>
      <CardContent>
        <TechRadar
          quadrants={["Languages", "Data", "Testing", "Build"]}
          rings={["Adopt", "Trial", "Assess", "Hold"]}
          blips={blips}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Positions are fixed by name between quarters <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          This quarter
        </div>
      </CardFooter>
    </Card>
  )
}
